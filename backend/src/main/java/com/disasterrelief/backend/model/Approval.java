package com.disasterrelief.backend.model;

import com.disasterrelief.backend.store.HasCid;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Approval/rejection decision on a supply request. Stored as an IPFS JSON document. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Approval implements HasCid {
    private UUID id;
    private UUID supplyRequestId;
    private UUID approverUserId;
    private ApprovalStatus status;
    private String comments;
    private String txHash;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
    private String cid;
}
