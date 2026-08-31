package com.disasterrelief.backend.service;

import com.disasterrelief.backend.model.InventoryItem;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class InventoryItemService extends EntityService<InventoryItem> {

    public InventoryItemService(DocumentStoreFactory factory) {
        super(factory, "inventoryItems", InventoryItem.class);
    }

    @Override
    protected String idOf(InventoryItem entity) {
        return entity.getId() == null ? null : entity.getId().toString();
    }

    @Override
    protected void setId(InventoryItem entity, String id) {
        entity.setId(UUID.fromString(id));
    }

    /** Finds the inventory record for a facility + relief item, if any. */
    public Optional<InventoryItem> findByFacilityAndItem(UUID facilityId, UUID reliefItemId) throws Exception {
        return list().stream()
                .filter(i -> facilityId.equals(i.getFacilityId()) && reliefItemId.equals(i.getReliefItemId()))
                .findFirst();
    }
}
