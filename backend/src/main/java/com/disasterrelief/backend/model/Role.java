package com.disasterrelief.backend.model;

/**
 * Application-level roles controlling access to REST APIs and UI.
 * These are enforced by Spring Security (@PreAuthorize).
 * They are SEPARATE from the blockchain roles managed by the smart contract.
 */
public enum Role {
    GOVERNMENT_ADMIN,
    WAREHOUSE_MANAGER,
    CAMP_MANAGER,
    NGO_COORDINATOR,
    TRANSPORT_OFFICER
}
