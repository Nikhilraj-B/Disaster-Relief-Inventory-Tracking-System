package com.disasterrelief.backend.model;

import com.disasterrelief.backend.store.HasCid;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Quantity of a relief item stored at a facility. Stored as an IPFS JSON document. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryItem implements HasCid {
    private UUID id;
    private UUID facilityId;
    private UUID reliefItemId;
    private BigDecimal quantity;
    private BigDecimal reservedQuantity;
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
    private String cid;
}
