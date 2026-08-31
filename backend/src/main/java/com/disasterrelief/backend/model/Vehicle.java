package com.disasterrelief.backend.model;

import com.disasterrelief.backend.store.HasCid;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/** Transport vehicle owned by an organization. Stored as an IPFS JSON document. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Vehicle implements HasCid {
    private UUID id;
    private UUID organizationId;
    private String registrationNumber;
    private String vehicleType;
    private BigDecimal capacityKg;
    @Builder.Default
    private boolean active = true;
    private String cid;
}
