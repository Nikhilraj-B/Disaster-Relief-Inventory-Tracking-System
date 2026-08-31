package com.disasterrelief.backend.model;

import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/** A single item line within a supply request. Embedded in the SupplyRequest document. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RequestItem {
    private UUID reliefItemId;
    private String itemName;
    private ReliefItemCategory itemCategory;
    private BigDecimal requestedQty;
    private BigDecimal fulfilledQty;
}
