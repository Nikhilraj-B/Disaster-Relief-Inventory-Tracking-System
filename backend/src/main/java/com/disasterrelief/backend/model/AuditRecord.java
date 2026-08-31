package com.disasterrelief.backend.model;

import com.disasterrelief.backend.store.HasCid;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** Internal audit log for Web2 application events. Stored as an IPFS JSON document. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditRecord implements HasCid {
    private UUID id;
    private UUID userId;
    private String action;
    private String resourceType;
    private UUID resourceId;
    private String ipAddress;
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
    private String cid;
}
