package com.disasterrelief.backend.model;

import com.disasterrelief.backend.store.HasCid;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The canonical supply chain workflow entity. Stored as an IPFS JSON document.
 *
 * status is the SINGLE source of truth for the whole supply chain workflow
 * (derived shipment status comes from here). ML results (mlClassification,
 * mlConfidence) are analytical decision support — NOT blockchain workflow state.
 * txHash* fields and txHashes are Ethereum transaction references that were
 * VERIFIED against the blockchain before this document was persisted.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupplyRequest implements HasCid {
    private UUID id;
    private UUID campId;
    private UUID warehouseId;
    @Builder.Default
    private SupplyRequestStatus status = SupplyRequestStatus.CREATED;
    private MlClassification mlClassification;
    private BigDecimal mlConfidence;
    private String txHashCreate;
    private String txHashReceipt;
    /** Verified transaction hashes per workflow step (state -> txHash). */
    @Builder.Default
    private Map<String, String> txHashes = new HashMap<>();
    @Builder.Default
    private List<RequestItem> items = new ArrayList<>();
    private UUID createdBy;
    private UUID acceptedByManagerId;
    private UUID assignedVehicleId;
    private String assignedDriverName;
    private String assignedDriverId;
    private UUID assignedTransporterId;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
    private String cid;
}
