package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.model.AuditRecord;
import com.disasterrelief.backend.service.AuditService;
import com.disasterrelief.backend.service.EntityService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only audit trail, restricted to the government admin. */
@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN')")
public class AuditController extends EntityController<AuditRecord> {

    private final AuditService auditService;

    @Override
    protected EntityService<AuditRecord> service() {
        return auditService;
    }
}
