package com.disasterrelief.backend.blockchain;

/**
 * Raised when an Ethereum transaction fails any of the independent
 * verification checks performed by {@link EthereumService}. Mapped to a
 * 400 Bad Request by the global exception handler; no IPFS state is updated.
 */
public class EthereumVerificationException extends RuntimeException {

    public EthereumVerificationException(String message) {
        super(message);
    }
}
