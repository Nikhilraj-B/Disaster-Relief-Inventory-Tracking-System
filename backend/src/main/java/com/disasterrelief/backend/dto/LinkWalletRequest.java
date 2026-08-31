package com.disasterrelief.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Body for linking a MetaMask wallet to the currently authenticated user.
 * Only the wallet address is sent; the account is resolved from the JWT
 * session on the backend, so a caller can never attach a wallet to somebody
 * else's account.
 */
public record LinkWalletRequest(
        @NotBlank(message = "walletAddress is required")
        @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "walletAddress must be a valid 0x Ethereum address (20 bytes)")
        String walletAddress) {
}