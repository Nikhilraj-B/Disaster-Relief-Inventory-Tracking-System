package com.disasterrelief.backend.model;

import com.disasterrelief.backend.store.HasCid;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/** In-app notification for a user. Stored as an IPFS JSON document. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification implements HasCid {
    private UUID id;
    private UUID userId;
    private String message;
    @Builder.Default
    private boolean read = false;
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
    private String cid;
}
