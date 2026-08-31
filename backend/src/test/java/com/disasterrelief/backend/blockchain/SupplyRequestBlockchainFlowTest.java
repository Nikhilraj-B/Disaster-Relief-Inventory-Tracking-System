package com.disasterrelief.backend.blockchain;

import com.disasterrelief.backend.ipfs.IpfsStore;
import com.disasterrelief.backend.model.Role;
import com.disasterrelief.backend.model.SupplyRequest;
import com.disasterrelief.backend.model.SupplyRequestStatus;
import com.disasterrelief.backend.model.User;
import com.disasterrelief.backend.store.DocumentStore;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import com.disasterrelief.backend.store.UserStore;
import com.disasterrelief.backend.service.SupplyRequestService;
import com.disasterrelief.backend.testutil.InMemoryIpfsClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Proves the wiring rule: a transaction hash supplied by the frontend is NEVER
 * trusted. When EthereumService rejects it (fake/missing/unrelated hash) the
 * supply request state on IPFS must remain untouched.
 *
 * A hand-written fake EthereumService ({@code @Primary} bean, no mockito/bytebuddy)
 * rejects any hash starting with 0xab; the test then asserts that neither the
 * status nor the document changed on IPFS. A second test shows that when
 * verification DOES pass, IPFS is updated.
 */
@SpringBootTest
class SupplyRequestBlockchainFlowTest {

    @Autowired
    private SupplyRequestService supplyRequestService;
    @Autowired
    private DocumentStoreFactory documentStoreFactory;
    @Autowired
    private UserStore userStore;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private static final String WALLET = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    private static final String FAKE_TX = "0x" + "ab".repeat(32);
    private static final String GOOD_TX = "0x" + "9c".repeat(32);
    private DocumentStore<SupplyRequest> store;
    private UUID requestId;
    private SupplyRequest seed;

    /**
     * Controllable fake verifier: hashes prefixed "0xab" are rejected (treated
     * as fake/unverifiable), everything else is accepted. This isolates the
     * service+store wiring test from the live node while keeping the exact
     * split-second behavior: a rejected hash must not touch IPFS.
     */
    @TestConfiguration
    static class FakeVerifierConfiguration {
        /**
         * In-memory IPFS so the flow test does not require a live Kubo daemon.
         * Real IpfsStore/UserStore/DocumentStore logic runs against the fake.
         */
        @Bean
        @Primary
        IpfsStore inMemoryIpfsStore() {
            return new IpfsStore(new InMemoryIpfsClient(), new ObjectMapper());
        }

        @Bean
        @Primary
        EthereumService fakeEthereumService() {
            return new EthereumService("http://127.0.0.1:8545", 31337,
                    "0x5FbDB2315678afecb367f032d93F642f64180aa3", new ObjectMapper()) {
                @Override
                public VerificationResult verify(String txHash, String expectedContractAddress,
                        long expectedChainId, String expectedRequestIdHex, String expectedActorWallet,
                        BlockchainFunction function, int expectedStatusOrdinal)
                        throws IOException, InterruptedException {
                    if (txtHashIsFake(txHash)) {
                        throw new EthereumVerificationException("Transaction not found: " + txHash);
                    }
                    return new VerificationResult(txHash, 5, 31337, expectedActorWallet.toLowerCase(),
                            expectedContractAddress.toLowerCase(), function.name(), function.selector(),
                            expectedRequestIdHex, null, expectedStatusOrdinal, true, true);
                }
            };
        }

        private boolean txtHashIsFake(String txHash) {
            return txHash != null && txHash.startsWith("0xab") && txHash.length() == 66;
        }
    }

    @BeforeEach
    void setUp() throws Exception {
        store = documentStoreFactory.create("supplyRequests", SupplyRequest.class);

        // Authenticate as a camp manager with a linked wallet (security context).
        User camp = User.builder()
                .email("flow-test-camp@example.com")
                .passwordHash(passwordEncoder.encode("Test1234!"))
                .fullName("Flow Camp")
                .role(Role.CAMP_MANAGER)
                .walletAddress(WALLET)
                .enabled(true)
                .build();
        userStore.save(camp);
        Authentication auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                camp, null, camp.getAuthorities());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);

        // Seed a CREATED request on IPFS directly (blockchain create tested elsewhere).
        requestId = UUID.randomUUID();
        seed = SupplyRequest.builder()
                .id(requestId)
                .campId(UUID.randomUUID())
                .warehouseId(UUID.randomUUID())
                .status(SupplyRequestStatus.CREATED)
                .items(List.of())
                .build();
        store.save(requestId.toString(), seed);
    }

    @Test
    void fakeTransactionHashDoesNotUpdateIpfs() throws Exception {
        assertThrows(EthereumVerificationException.class,
                () -> supplyRequestService.transitionBlockchain(requestId.toString(),
                        SupplyRequestStatus.CREATED, SupplyRequestStatus.APPROVED,
                        BlockchainFunction.APPROVE_REQUEST, FAKE_TX));

        SupplyRequest after = store.findById(requestId.toString()).orElseThrow();
        assertEquals(SupplyRequestStatus.CREATED, after.getStatus(),
                "IPFS status must remain CREATED when verification fails");
        assertTrue(after.getTxHashes().isEmpty(),
                "No tx hash may be recorded when verification fails");
    }

    @Test
    void fakeRejectTransactionDoesNotUpdateIpfs() throws Exception {
        assertThrows(EthereumVerificationException.class,
                () -> supplyRequestService.rejectBlockchain(requestId.toString(), null, "bad", FAKE_TX));

        SupplyRequest after = store.findById(requestId.toString()).orElseThrow();
        assertEquals(SupplyRequestStatus.CREATED, after.getStatus());
        assertTrue(after.getTxHashes().isEmpty());
    }

    @Test
    void verifiedTransactionUpdatesIpfs() throws Exception {
        SupplyRequest updated = supplyRequestService.transitionBlockchain(requestId.toString(),
                SupplyRequestStatus.CREATED, SupplyRequestStatus.APPROVED,
                BlockchainFunction.APPROVE_REQUEST, GOOD_TX);

        assertEquals(SupplyRequestStatus.APPROVED, updated.getStatus());
        assertEquals(GOOD_TX, updated.getTxHashes().get("APPROVED"));

        SupplyRequest persisted = store.findById(requestId.toString()).orElseThrow();
        assertEquals(SupplyRequestStatus.APPROVED, persisted.getStatus(),
                "Verified transaction must persist the new state on IPFS");
    }
}