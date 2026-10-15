package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.model.ReliefItem;
import com.disasterrelief.backend.service.EntityService;
import com.disasterrelief.backend.service.ReliefItemService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/relief-items")
@RequiredArgsConstructor
public class ReliefItemController extends EntityController<ReliefItem> {

    private final ReliefItemService reliefItemService;

    @Override
    protected EntityService<ReliefItem> service() {
        return reliefItemService;
    }

    @Override
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE_MANAGER')")
    public ResponseEntity<ReliefItem> create(ReliefItem entity) throws Exception {
        return super.create(entity);
    }

    @Override
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE_MANAGER')")
    public ResponseEntity<ReliefItem> update(String id, ReliefItem entity) throws Exception {
        return super.update(id, entity);
    }
}
