package com.disasterrelief.backend.model;

import com.disasterrelief.backend.store.HasCid;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** A relief organization (government body or NGO). Stored as an IPFS JSON document. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Organization implements HasCid {
    private UUID id;
    private String name;
    private OrganizationType type;
    private String contactInfo;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
    private String cid;
}
