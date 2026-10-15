package com.disasterrelief.backend.service;

import com.disasterrelief.backend.dto.AuthResponse;
import com.disasterrelief.backend.ipfs.IpfsStore;
import com.disasterrelief.backend.model.Role;
import com.disasterrelief.backend.model.User;
import com.disasterrelief.backend.security.JwtUtil;
import com.disasterrelief.backend.store.UserStore;
import com.disasterrelief.backend.testutil.InMemoryIpfsClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the wallet-linking path of {@link AuthService}.
 * Proves the security rule: the target account is derived from the
 * authenticated session (JWT), never from the request payload, so a caller
 * cannot attach a wallet to any account but their own.
 *
 * No mockito/bytebuddy: the real {@link UserStore} runs against an in-memory
 * {@link InMemoryIpfsClient}, and {@link JwtUtil}/{@link AuthenticationManager}
 * are tiny hand-written fakes - so the suite runs unchanged under JDK 25.
 */
class AuthServiceWalletLinkTest {

    private static final String EMAIL = "camp@disasterrelief.gov";
    private static final String WALLET = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

    private UserStore userStore;
    private AuthService authService;

    @BeforeEach
    void setUp() throws Exception {
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        IpfsStore ipfsStore = new IpfsStore(new InMemoryIpfsClient(), mapper);
        userStore = new UserStore(ipfsStore, mapper);

        // Hand-written fakes (no mockito): JwtUtil just stamps a fixed token,
        // AuthenticationManager is never consulted by linkWallet.
        JwtUtil jwtUtil = new JwtUtil() {
            @Override
            public String generateToken(UserDetails userDetails) {
                return "jwt-token";
            }
        };
        AuthenticationManager authenticationManager = auth -> auth;

        authService = new AuthService(userStore, new BCryptPasswordEncoder(), jwtUtil, authenticationManager, null);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private User saveUser(String email, String wallet) throws Exception {
        User user = User.builder()
                .email(email)
                .passwordHash(new BCryptPasswordEncoder().encode("Test1234!"))
                .fullName("Camp Manager")
                .role(Role.CAMP_MANAGER)
                .walletAddress(wallet)
                .build();
        return userStore.save(user);
    }

    private void authenticateAs(User principal) {
        Authentication auth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    void linksWalletToAuthenticatedUser() throws Exception {
        User user = saveUser(EMAIL, null);
        authenticateAs(user);

        AuthResponse res = authService.linkWallet(WALLET);

        assertEquals(WALLET, res.getWalletAddress());
        // The wallet must be persisted for the authenticated user on IPFS.
        User persisted = userStore.findByEmail(EMAIL).orElseThrow();
        assertEquals(WALLET, persisted.getWalletAddress());
        assertEquals(EMAIL, persisted.getEmail());
    }

    @Test
    void rejectsWalletLinkWhenNotAuthenticated() throws Exception {
        saveUser(EMAIL, null);
        SecurityContextHolder.clearContext();

        assertThrows(RuntimeException.class, () -> authService.linkWallet(WALLET));

        // No save may have happened for the unauthenticated caller.
        User persisted = userStore.findByEmail(EMAIL).orElseThrow();
        assertNull(persisted.getWalletAddress());
    }

    @Test
    void rejectsWalletLinkForUnknownUser() throws Exception {
        // Authenticated as a principal whose account does not exist in the store.
        User ghost = User.builder()
                .email("ghost@disasterrelief.gov")
                .role(Role.CAMP_MANAGER)
                .build();
        authenticateAs(ghost);

        assertThrows(RuntimeException.class, () -> authService.linkWallet(WALLET));

        // Nothing may be created or modified for an unknown account.
        assertTrue(userStore.findByEmail("ghost@disasterrelief.gov").isEmpty());
    }
}
