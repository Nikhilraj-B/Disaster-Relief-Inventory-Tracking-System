package com.disasterrelief.backend.service;

import com.disasterrelief.backend.model.AuditRecord;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuditService extends EntityService<AuditRecord> {

    public AuditService(DocumentStoreFactory factory) {
        super(factory, "auditRecords", AuditRecord.class);
    }

    @Override
    protected String idOf(AuditRecord entity) {
        return entity.getId() == null ? null : entity.getId().toString();
    }

    @Override
    protected void setId(AuditRecord entity, String id) {
        entity.setId(UUID.fromString(id));
    }

    public void record(UUID userId, String action, String resourceType, UUID resourceId, String ipAddress) {
        try {
            create(AuditRecord.builder()
                    .userId(userId)
                    .action(action)
                    .resourceType(resourceType)
                    .resourceId(resourceId)
                    .ipAddress(ipAddress)
                    .build());
        } catch (Exception e) {
            // Audit must never break the main flow.
            logAuditFailure(action, e);
        }
    }

    private void logAuditFailure(String action, Exception e) {
        System.err.println("[Audit] failed to record '" + action + "': " + e.getMessage());
    }
}
