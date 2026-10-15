package com.disasterrelief.backend.model;

/**
 * Application-level roles controlling access to REST APIs and UI.
 * These are enforced by Spring Security (@PreAuthorize).
 * They are SEPARATE from the blockchain roles managed by the smart contract.
 */
public enum Role {
    ADMIN,
    WAREHOUSE_MANAGER,
    CAMP_MANAGER,
    TRANSPORT_OFFICER
}
