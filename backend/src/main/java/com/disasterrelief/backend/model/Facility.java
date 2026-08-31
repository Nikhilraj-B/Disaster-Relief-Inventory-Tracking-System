package com.disasterrelief.backend.model;

import com.disasterrelief.backend.store.HasCid;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A facility: warehouse or camp. Stored as an IPFS JSON document.
 * Depending on type, either population/capacity (camp) or capacitySqm (warehouse) applies.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Facility implements HasCid {
    private UUID id;
    private UUID organizationId;
    private String name;
    private FacilityType type;
    private String location;
    private UUID managerUserId;
    private Integer population;
    private Integer maxCapacity;
    private BigDecimal capacitySqm;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
    private String cid;
}
