package com.disasterrelief.backend.blockchain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Verifies Ethereum transactions produced by the smart contract
 * (DisasterReliefAudit) independently of anything the frontend claims.
 *
 * The frontend only ever supplies a transaction hash. This service re-reads the
 * transaction, its receipt, and the contract state from the node, and rejects
 * the transition unless EVERY of the following holds:
 *  1. the transaction exists,
 *  2. it has been mined (a block was included),
 *  3. it succeeded (receipt status 0x1, i.e. not reverted),
 *  4. the node is on the expected chain (eth_chainId == configured chain id),
 *  5. the transaction target equals the deployed contract address,
 *  6. the calldata selector matches the function that is supposed to run,
 *  7. the encoded requestId matches the request being transitioned,
 *  8. the sender (tx.from) equals the wallet linked to the authenticated user,
 *  9. the resulting on-chain status equals the expected post-transition state,
 *     i.e. the correct state transition really happened on-chain.
 *
 * It communicates with the node via JSON-RPC using java.net.http.HttpClient
 * (the same minimal pattern as IpfsClient / MlServiceClient).
 */
@Service
@Slf4j
public class EthereumService {

    private final HttpClient httpClient;
    private final String rpcUrl;
    private final long chainId;
    private final String contractAddress;
    private final ObjectMapper objectMapper;

    public EthereumService(
            @Value("${app.ethereum.rpc-url}") String rpcUrl,
            @Value("${app.ethereum.chain-id}") long chainId,
            @Value("${app.ethereum.contract-address}") String contractAddress,
            ObjectMapper objectMapper) {
        this.rpcUrl = rpcUrl;
        this.chainId = chainId;
        this.contractAddress = contractAddress.toLowerCase(Locale.ROOT);
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Verifies one blockchain transaction for one expected transition and
     * returns the decoded facts. Throws {@link EthereumVerificationException}
     * if any check fails.
     *
     * @param expectedContractAddress contract that must have been the recipient
     * @param expectedChainId         chain the node must be on
     * @param expectedRequestIdHex    bytes32 (0x + 64 hex) for the request
     * @param expectedActorWallet     wallet that must have signed (tx.from)
     * @param function                which contract function must have been called
     * @param expectedStatusOrdinal   on-chain RequestStatus ordinal AFTER the tx
     */
    public VerificationResult verify(
            String txHash,
            String expectedContractAddress,
            long expectedChainId,
            String expectedRequestIdHex,
            String expectedActorWallet,
            BlockchainFunction function,
            int expectedStatusOrdinal) throws IOException, InterruptedException {
        txHash = normalizeHash(txHash);
        expectedContractAddress = expectedContractAddress.toLowerCase(Locale.ROOT);
        expectedActorWallet = expectedActorWallet.toLowerCase(Locale.ROOT);

        JsonNode tx = rpc("eth_getTransactionByHash", List.of(txHash));
        if (tx == null || tx.isNull() || tx.hasNonNull("hash") == false) {
            throw new EthereumVerificationException("Transaction not found: " + txHash);
        }
        if (tx.path("blockNumber").isNull() || tx.path("blockNumber").asText().isEmpty()) {
            throw new EthereumVerificationException("Transaction not yet mined: " + txHash);
        }
        long blockNumber = new BigInteger(tx.path("blockNumber").asText().substring(2), 16).longValue();

        JsonNode receipt = rpc("eth_getTransactionReceipt", List.of(txHash));
        if (receipt == null || receipt.isNull()) {
            throw new EthereumVerificationException("Transaction receipt not available (not mined): " + txHash);
        }
        String status = receipt.path("status").asText("0x0");
        if (!"0x1".equals(status.toLowerCase(Locale.ROOT))) {
            throw new EthereumVerificationException("Transaction failed/reverted: " + txHash + " (status " + status + ")");
        }

        long actualChainId = getChainId();
        if (actualChainId != expectedChainId) {
            throw new EthereumVerificationException("Wrong chain: expected " + expectedChainId + " but node is on " + actualChainId);
        }

        String to = tx.path("to").asText("").toLowerCase(Locale.ROOT);
        if (!expectedContractAddress.equals(to)) {
            throw new EthereumVerificationException("Wrong contract address: tx.to=" + to + " expected " + expectedContractAddress);
        }

        String input = tx.path("input").asText("");
        String selector = extractSelector(input);
        if (!function.selector().equalsIgnoreCase(selector)) {
            throw new EthereumVerificationException("Wrong function: selector " + selector + " expected " + function.selector()
                    + " (" + function.signature() + ")");
        }

        String decodedRequestId = extractWord(input, 0);
        if (!expectedRequestIdHex.equalsIgnoreCase(decodedRequestId)) {
            throw new EthereumVerificationException("Wrong request id: calldata " + decodedRequestId
                    + " expected " + expectedRequestIdHex);
        }

        String from = tx.path("from").asText("").toLowerCase(Locale.ROOT);
        if (!expectedActorWallet.equals(from)) {
            throw new EthereumVerificationException("Wrong actor wallet: tx.from=" + from + " expected " + expectedActorWallet);
        }

        // Optional second argument (address) - e.g. createRequest's warehouseWallet
        // or assignTransporter's transporterWallet. Decoded for cross-checking.
        String argAddress = null;
        if (hasSecondWord(input)) {
            String word = extractWord(input, 1);
            argAddress = "0x" + word.substring(word.length() - 40).toLowerCase(Locale.ROOT);
        }

        int onChainStatus = readRequestStatus(expectedRequestIdHex);
        if (onChainStatus != expectedStatusOrdinal) {
            throw new EthereumVerificationException("Invalid state transition: on-chain status " + onChainStatus
                    + " but expected " + expectedStatusOrdinal + " after " + function.signature());
        }

        boolean eventVerified = logContainsEvent(receipt, function.eventTopic0(), expectedRequestIdHex);

        VerificationResult result = new VerificationResult(txHash, blockNumber, actualChainId, from, to,
                function.name(), selector, decodedRequestId, argAddress, onChainStatus, eventVerified, true);
        log.info("Verified {} tx {} request {} -> on-chain status {} (block {})",
                function.name(), txHash, expectedRequestIdHex, onChainStatus, blockNumber);
        return result;
    }

    /** Reads the current on-chain status of a request via eth_call getRequest(bytes32). */
    public int readRequestStatus(String requestIdHex) throws IOException, InterruptedException {
        String data = BlockchainFunction.GET_REQUEST.selector() + requestIdHex.substring(2);
        JsonNode result = rpc("eth_call", List.of(
                MapOf("to", contractAddress, "data", data), "latest"));
        if (result == null || result.isNull()) {
            throw new EthereumVerificationException("eth_call getRequest returned null for " + requestIdHex);
        }
        String hex = result.asText("");
        if (hex.length() < 256) {
            throw new EthereumVerificationException("Unexpected getRequest result: " + hex);
        }
        // ABI: (address,address,address,uint8,uint256) => 5 x 32-byte words.
        // Status is the 4th word (word index 3 => hex 194..258, after the 0x prefix).
        String statusWord = hex.substring(194, 258);
        return new BigInteger(statusWord, 16).intValue();
    }

    /** Returns the node's current chain id via eth_chainId. */
    public long getChainId() throws IOException, InterruptedException {
        JsonNode result = rpc("eth_chainId", List.of());
        return new BigInteger(result.asText().substring(2), 16).longValue();
    }

    /** Configured chain id used for verification (defaults to Hardhat 31337). */
    public long configuredChainId() {
        return chainId;
    }

    /** Configured contract address used for verification. */
    public String configuredContractAddress() {
        return contractAddress;
    }

    // ------------------------------------------------------------------
    // JSON-RPC plumbing
    // ------------------------------------------------------------------

    private JsonNode rpc(String method, List<Object> params) throws IOException, InterruptedException {
        Map<String, Object> payload = MapOf("jsonrpc", "2.0", "method", method, "params", params, "id", 1);
        String body = objectMapper.writeValueAsString(payload);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(rpcUrl))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new EthereumVerificationException("JSON-RPC " + method + " failed: HTTP " + response.statusCode());
        }
        JsonNode node = objectMapper.readTree(response.body());
        JsonNode error = node.get("error");
        if (error != null && !error.isNull()) {
            throw new EthereumVerificationException("JSON-RPC " + method + " error: " + error);
        }
        return node.path("result");
    }

    private boolean logContainsEvent(JsonNode receipt, String eventTopic0, String requestIdHex) {
        JsonNode logs = receipt.path("logs");
        if (!logs.isArray()) {
            return false;
        }
        for (JsonNode log : logs) {
            JsonNode topics = log.path("topics");
            if (!topics.isArray() || topics.size() < 2) {
                continue;
            }
            String topic0 = topics.get(0).asText("").toLowerCase(Locale.ROOT);
            String topic1 = topics.get(1).asText("").toLowerCase(Locale.ROOT);
            if (eventTopic0.equalsIgnoreCase(topic0) && requestIdHex.equalsIgnoreCase(topic1)) {
                return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------------
    // Calldata / ABI decoding helpers
    // ------------------------------------------------------------------

    private static String normalizeHash(String txHash) {
        if (txHash == null || txHash.isBlank()) {
            throw new EthereumVerificationException("Transaction hash is required");
        }
        return txHash.trim().toLowerCase(Locale.ROOT);
    }

    private static String extractSelector(String input) {
        if (input == null || !input.startsWith("0x") || input.length() < 10) {
            throw new EthereumVerificationException("Invalid calldata: " + input);
        }
        return input.substring(0, 10).toLowerCase(Locale.ROOT);
    }

    /** Extracts the (index)th 32-byte word (64 hex chars) from calldata, starting after the 4-byte selector. */
    private static String extractWord(String input, int index) {
        String hex = input.startsWith("0x") ? input.substring(2) : input;
        int start = 8 + index * 64;
        if (hex.length() < start + 64) {
            throw new EthereumVerificationException("Calldata too short to decode word " + index);
        }
        return "0x" + hex.substring(start, start + 64).toLowerCase(Locale.ROOT);
    }

    /** True if calldata carries a second 32-byte argument after the selector. */
    private static boolean hasSecondWord(String input) {
        String hex = input.startsWith("0x") ? input.substring(2) : input;
        return hex.length() >= 8 + 2 * 64;
    }

    /**
     * Deterministic bytes32 for a SupplyRequest UUID: the 32 hex characters of
     * the UUID (no dashes) zero-padded on the right to 64 hex chars.
     * Frontend uses the identical derivation (see frontend blockchain util).
     */
    public static String bytes32FromUuid(UUID uuid) {
        String hex = uuid.toString().replace("-", "").toLowerCase(Locale.ROOT);
        return "0x" + hex + "0".repeat(64 - hex.length());
    }

    /** Minimal immutable map helper (avoids type inference noise in JSON-RPC payloads). */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> MapOf(Object... kv) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }
}
