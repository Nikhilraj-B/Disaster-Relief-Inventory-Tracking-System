package com.disasterrelief.backend.blockchain;

/**
 * Result of a successful {@link EthereumService#verify} of a transition.
 * Carries the decoded on-chain facts so callers can audit and persist what
 * was actually verified rather than what the frontend claimed.
 */
public record VerificationResult(
        String txHash,
        long blockNumber,
        long chainId,
        String from,
        String to,
        String function,
        String selector,
        String requestId,
        String argAddress,
        int onChainStatus,
        boolean eventVerified,
        boolean verified) {
}
