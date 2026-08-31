package com.disasterrelief.backend.model;

/**
 * Canonical supply chain workflow status (mirrors the smart contract's RequestStatus).
 * NONE = not yet created on-chain. Rejections are only allowed from CREATED and APPROVED.
 */
public enum SupplyRequestStatus {
    NONE,
    CREATED,
    APPROVED,
    ACCEPTED,
    DISPATCHED,
    IN_TRANSIT,
    ARRIVED,
    RECEIVED,
    COMPLETED,
    REJECTED
}
