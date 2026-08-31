package com.disasterrelief.backend.service;

import com.disasterrelief.backend.model.InventoryTransaction;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class InventoryTransactionService extends EntityService<InventoryTransaction> {

    public InventoryTransactionService(DocumentStoreFactory factory) {
        super(factory, "inventoryTransactions", InventoryTransaction.class);
    }

    @Override
    protected String idOf(InventoryTransaction entity) {
        return entity.getId() == null ? null : entity.getId().toString();
    }

    @Override
    protected void setId(InventoryTransaction entity, String id) {
        entity.setId(UUID.fromString(id));
    }
}
