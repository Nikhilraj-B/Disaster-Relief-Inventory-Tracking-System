package com.disasterrelief.backend.blockchain;

import com.disasterrelief.backend.blockchain.EthereumService;
import com.disasterrelief.backend.blockchain.EthereumVerificationException;
import com.disasterrelief.backend.blockchain.BlockchainFunction;
import com.disasterrelief.backend.blockchain.VerificationResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Deterministic unit tests for {@link EthereumService} against an in-process
 * fake JSON-RPC node. Each test drives one of the verification scenarios:
 * valid tx, non-existent hash, failed/reverted tx, wrong contract, wrong chain,
 * wrong request id, wrong actor, and both valid + invalid state transitions.
 */
class EthereumServiceTest {

    private static final String CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    private static final long CHAIN = 31337;
    private static final String WALLET = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    private static final String REQUEST = "0x111122223333444455556666777788889999aaaabbbbccccdddd111122223333";
    private static final String TX = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private HttpServer server;
    private EthereumService service;
    private ObjectMapper mapper;

    private String txResponse;      // JSON for eth_getTransactionByHash (or "null")
    private String receiptResponse; // JSON for eth_getTransactionReceipt (or "null")
    private String chainResponse;   // 0x-prefixed hex chain id
    private String getRequestHex;   // ABI-encoded getRequest result (or null)

    @BeforeEach
    void setUp() throws Exception {
        mapper = new ObjectMapper();
        txResponse = null;
        receiptResponse = null;
        chainResponse = "0x7a69";
        getRequestHex = encodeGetRequest(1);

        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/", exchange -> {
            byte[] body = exchange.getRequestBody().readAllBytes();
            JsonNode req = mapper.readTree(body);
            String method = req.path("method").asText();
            String result;
            switch (method) {
                case "eth_getTransactionByHash" -> result = txResponse;
                case "eth_getTransactionReceipt" -> result = receiptResponse;
                case "eth_chainId" -> result = "\"" + chainResponse + "\"";
                case "eth_call" -> result = getRequestHex == null ? "null" : "\"" + getRequestHex + "\"";
                default -> result = "\"\"";
            }
            String out = "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":" + result + "}";
            byte[] bytes = out.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });
        server.start();

        service = new EthereumService(
                "http://127.0.0.1:" + server.getAddress().getPort(), CHAIN, CONTRACT, mapper);
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    // ------------------------------------------------------------------
    // Helpers to craft on-chain fixtures
    // ------------------------------------------------------------------

    private String selectorFor(BlockchainFunction fn) {
        return fn.selector().substring(2);
    }

    private String txJson(String from, String to, String input, String blockNumber) {
        return "{"
                + "\"hash\":\"" + TX + "\","
                + "\"blockNumber\":\"" + blockNumber + "\","
                + "\"from\":\"" + from.toLowerCase() + "\","
                + "\"to\":\"" + to.toLowerCase() + "\","
                + "\"input\":\"" + input + "\""
                + "}";
    }

    private String receiptJson(String status, String eventTopic0) {
        String topics = eventTopic0 == null ? "" :
                "\"topics\":[\"" + eventTopic0 + "\",\"" + REQUEST + "\"]";
        return "{"
                + "\"transactionHash\":\"" + TX + "\","
                + "\"status\":\"" + status + "\","
                + "\"blockNumber\":\"0x5\","
                + "\"logs\":[{" + topics + ",\"data\":\"0x\"}]"
                + "}";
    }

    /** ABI-encodes getRequest(bytes32) return: (address,address,address,uint8,uint256). */
    private String encodeGetRequest(int status) {
        String word = "0000000000000000000000000000000000000000000000000000000000000000";
        StringBuilder sb = new StringBuilder("0x");
        for (int i = 0; i < 5; i++) {
            if (i == 3 && status > 0) {
                String hex = String.format("%064x", status);
                sb.append(hex);
            } else {
                sb.append(word);
            }
        }
        return sb.toString();
    }

    private String calldata(BlockchainFunction fn) {
        return "0x" + selectorFor(fn) + REQUEST.substring(2);
    }

    private BlockchainFunction function(BlockchainFunction fn) {
        return fn;
    }

    // ------------------------------------------------------------------
    // Happy path: valid transaction, mined, success, correct everything
    // ------------------------------------------------------------------

    @Test
    void verifiesValidTransaction() throws Exception {
        txResponse = txJson(WALLET, CONTRACT, calldata(BlockchainFunction.APPROVE_REQUEST), "0x5");
        receiptResponse = receiptJson("0x1", BlockchainFunction.APPROVE_REQUEST.eventTopic0());
        getRequestHex = encodeGetRequest(2); // APPROVED after approveRequest

        VerificationResult vr = service.verify(TX, CONTRACT, CHAIN, REQUEST, WALLET,
                BlockchainFunction.APPROVE_REQUEST, 2);
        assertTrue(vr.verified());
        assertTrue(vr.eventVerified());
        assertEquals(5, vr.blockNumber());
        assertEquals(WALLET.toLowerCase(), vr.from());
        assertEquals(CONTRACT.toLowerCase(), vr.to());
        assertEquals(2, vr.onChainStatus());
        assertEquals(REQUEST, vr.requestId());
        assertEquals(Long.toHexString(31337), Long.toHexString(vr.chainId()));
    }

    @Test
    void verifiesValidStateTransition() throws Exception {
        txResponse = txJson(WALLET, CONTRACT, "0x" + selectorFor(BlockchainFunction.COMPLETE_REQUEST) + REQUEST.substring(2), "0x9");
        receiptResponse = receiptJson("0x1", BlockchainFunction.COMPLETE_REQUEST.eventTopic0());
        getRequestHex = encodeGetRequest(8); // COMPLETED

        VerificationResult vr = service.verify(TX, CONTRACT, CHAIN, REQUEST, WALLET,
                BlockchainFunction.COMPLETE_REQUEST, 8);
        assertTrue(vr.verified());
        assertEquals(8, vr.onChainStatus());
    }

    @Test
    void rejectsNonExistentHash() throws Exception {
        txResponse = "null";
        receiptResponse = "null";
        assertThrows(EthereumVerificationException.class, () ->
                service.verify(TX, CONTRACT, CHAIN, REQUEST, WALLET, BlockchainFunction.APPROVE_REQUEST, 2));
    }

    @Test
    void rejectsFailedOrRevertedTransaction() throws Exception {
        txResponse = txJson(WALLET, CONTRACT, calldata(BlockchainFunction.APPROVE_REQUEST), "0x5");
        receiptResponse = receiptJson("0x0", BlockchainFunction.APPROVE_REQUEST.eventTopic0());
        assertThrows(EthereumVerificationException.class, () ->
                service.verify(TX, CONTRACT, CHAIN, REQUEST, WALLET, BlockchainFunction.APPROVE_REQUEST, 2));
    }

    @Test
    void rejectsWrongContractAddress() throws Exception {
        txResponse = txJson(WALLET, "0xDead00000000000000000000000000000000deAd",
                calldata(BlockchainFunction.APPROVE_REQUEST), "0x5");
        receiptResponse = receiptJson("0x1", BlockchainFunction.APPROVE_REQUEST.eventTopic0());
        getRequestHex = encodeGetRequest(2);
        assertThrows(EthereumVerificationException.class, () ->
                service.verify(TX, CONTRACT, CHAIN, REQUEST, WALLET, BlockchainFunction.APPROVE_REQUEST, 2));
    }

    @Test
    void rejectsWrongChain() {
        txResponse = txJson(WALLET, CONTRACT, calldata(BlockchainFunction.APPROVE_REQUEST), "0x5");
        receiptResponse = receiptJson("0x1", BlockchainFunction.APPROVE_REQUEST.eventTopic0());
        getRequestHex = encodeGetRequest(2);
        chainResponse = "0x1"; // node reports mainnet
        assertThrows(EthereumVerificationException.class, () ->
                service.verify(TX, CONTRACT, CHAIN, REQUEST, WALLET, BlockchainFunction.APPROVE_REQUEST, 2));
    }

    @Test
    void rejectsWrongRequestId() throws Exception {
        String otherRequest = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
        txResponse = txJson(WALLET, CONTRACT, "0x" + selectorFor(BlockchainFunction.APPROVE_REQUEST) + otherRequest.substring(2), "0x5");
        receiptResponse = receiptJson("0x1", BlockchainFunction.APPROVE_REQUEST.eventTopic0());
        getRequestHex = encodeGetRequest(2);
        assertThrows(EthereumVerificationException.class, () ->
                service.verify(TX, CONTRACT, CHAIN, REQUEST, WALLET, BlockchainFunction.APPROVE_REQUEST, 2));
    }

    @Test
    void rejectsWrongActorWallet() throws Exception {
        txResponse = txJson("0x000000000000000000000000000000000000dEaD",
                CONTRACT, calldata(BlockchainFunction.APPROVE_REQUEST), "0x5");
        receiptResponse = receiptJson("0x1", BlockchainFunction.APPROVE_REQUEST.eventTopic0());
        getRequestHex = encodeGetRequest(2);
        assertThrows(EthereumVerificationException.class, () ->
                service.verify(TX, CONTRACT, CHAIN, REQUEST, WALLET, BlockchainFunction.APPROVE_REQUEST, 2));
    }

    @Test
    void rejectsInvalidStateTransition() throws Exception {
        txResponse = txJson(WALLET, CONTRACT, calldata(BlockchainFunction.APPROVE_REQUEST), "0x5");
        receiptResponse = receiptJson("0x1", BlockchainFunction.APPROVE_REQUEST.eventTopic0());
        getRequestHex = encodeGetRequest(1); // on-chain still CREATED, expected APPROVED
        assertThrows(EthereumVerificationException.class, () ->
                service.verify(TX, CONTRACT, CHAIN, REQUEST, WALLET, BlockchainFunction.APPROVE_REQUEST, 2));
    }
}