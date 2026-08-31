package com.disasterrelief.backend.model;

import com.disasterrelief.backend.store.HasCid;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Logged quantity change on an inventory item. Stored as an IPFS JSON document. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryTransaction implements HasCid {
    private UUID id;
    private UUID inventoryItemId;
    private InventoryTransactionType transactionType;
    private BigDecimal quantity;
    private String referenceType;
    private UUID referenceId;
    private UUID createdBy;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
    private String cid;
}
