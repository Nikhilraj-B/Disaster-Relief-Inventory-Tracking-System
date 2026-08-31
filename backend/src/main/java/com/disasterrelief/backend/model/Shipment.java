package com.disasterrelief.backend.model;

import com.disasterrelief.backend.store.HasCid;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Physical transport record for a supply request. Stored as an IPFS JSON document.
 * Status is intentionally omitted — it is derived from the linked SupplyRequest.status.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Shipment implements HasCid {
    private UUID id;
    private UUID supplyRequestId;
    private UUID transporterUserId;
    private UUID vehicleId;
    private LocalDateTime dispatchTime;
    private LocalDateTime arrivalTime;
    private String txHashDispatch;
    private String cid;
}
