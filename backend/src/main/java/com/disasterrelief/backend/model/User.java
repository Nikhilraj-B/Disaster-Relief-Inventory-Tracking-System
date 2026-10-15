package com.disasterrelief.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Represents a user in the application.
 * wallet_address links application identity to Ethereum for blockchain authorization.
 * Stored as a JSON document on IPFS (CID -> immutable content) — password_hash is
 * NEVER sent to the blockchain. cid is the IPFS content identifier that stores this
 * user's document; the latest revision is discovered via the users index document.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User implements UserDetails {

    private static final long serialVersionUID = 1L;

    private UUID id;

    private String email;

    private String passwordHash;

    private Role role;

    /**
     * Links this user's application identity to their MetaMask wallet address.
     * The smart contract uses this address for blockchain role assignment.
     * Format: 0x prefixed Ethereum address, 42 chars max.
     */
    private String walletAddress;

    private String fullName;

    /** Facility (Camp or Warehouse) to which this user is assigned. */
    private UUID facilityId;

    @Builder.Default
    private boolean enabled = true;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    /** IPFS CID of the latest revision of this user's JSON document. */
    private String cid;

    // --- UserDetails contract (not serialized to IPFS documents) ---

    @Override
    @JsonIgnore
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    @JsonIgnore
    public String getPassword() {
        return passwordHash;
    }

    @Override
    @JsonIgnore
    public String getUsername() {
        return email;
    }

    @Override
    @JsonIgnore
    public boolean isAccountNonExpired() { return true; }

    @Override
    @JsonIgnore
    public boolean isAccountNonLocked() { return true; }

    @Override
    @JsonIgnore
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    @JsonIgnore
    public boolean isEnabled() { return enabled; }

    public void touch() {
        this.updatedAt = LocalDateTime.now();
    }
}
