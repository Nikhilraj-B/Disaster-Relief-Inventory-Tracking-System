package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.model.InventoryItem;
import com.disasterrelief.backend.service.EntityService;
import com.disasterrelief.backend.service.InventoryItemService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryItemController extends EntityController<InventoryItem> {

    private final InventoryItemService inventoryItemService;

    @Override
    protected EntityService<InventoryItem> service() {
        return inventoryItemService;
    }

    @Override
    @PreAuthorize("hasAnyRole('WAREHOUSE_MANAGER','GOVERNMENT_ADMIN')")
    public ResponseEntity<InventoryItem> create(InventoryItem entity) throws Exception {
        return super.create(entity);
    }

    @Override
    @PreAuthorize("hasAnyRole('WAREHOUSE_MANAGER','GOVERNMENT_ADMIN')")
    public ResponseEntity<InventoryItem> update(String id, InventoryItem entity) throws Exception {
        return super.update(id, entity);
    }
}
