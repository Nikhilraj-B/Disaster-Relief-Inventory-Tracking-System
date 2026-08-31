package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.model.InventoryTransaction;
import com.disasterrelief.backend.service.EntityService;
import com.disasterrelief.backend.service.InventoryTransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inventory-transactions")
@RequiredArgsConstructor
public class InventoryTransactionController extends EntityController<InventoryTransaction> {

    private final InventoryTransactionService transactionService;

    @Override
    protected EntityService<InventoryTransaction> service() {
        return transactionService;
    }

    @Override
    @PreAuthorize("hasAnyRole('WAREHOUSE_MANAGER','GOVERNMENT_ADMIN')")
    public ResponseEntity<InventoryTransaction> create(InventoryTransaction entity) throws Exception {
        return super.create(entity);
    }
}
