package com.disasterrelief.backend.service;

import com.disasterrelief.backend.model.InventoryItem;
import com.disasterrelief.backend.model.InventoryTransaction;
import com.disasterrelief.backend.model.InventoryTransactionType;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class InventoryItemService extends EntityService<InventoryItem> {

    private final InventoryTransactionService transactionService;

    public InventoryItemService(DocumentStoreFactory factory, InventoryTransactionService transactionService) {
        super(factory, "inventoryItems", InventoryItem.class);
        this.transactionService = transactionService;
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

    @Override
    public InventoryItem create(InventoryItem entity) throws Exception {
        if (entity.getFacilityId() != null && entity.getReliefItemId() != null) {
            Optional<InventoryItem> existing = findByFacilityAndItem(entity.getFacilityId(), entity.getReliefItemId());
            if (existing.isPresent()) {
                InventoryItem item = existing.get();
                BigDecimal current = item.getQuantity() == null ? BigDecimal.ZERO : item.getQuantity();
                BigDecimal toAdd = entity.getQuantity() == null ? BigDecimal.ZERO : entity.getQuantity();
                item.setQuantity(current.add(toAdd));
                item.setUpdatedAt(LocalDateTime.now());
                update(item);

                if (transactionService != null && toAdd.compareTo(BigDecimal.ZERO) != 0) {
                    try {
                        transactionService.create(InventoryTransaction.builder()
                                .inventoryItemId(item.getId())
                                .transactionType(toAdd.compareTo(BigDecimal.ZERO) > 0 ? InventoryTransactionType.ADD : InventoryTransactionType.SUBTRACT)
                                .quantity(toAdd.abs())
                                .createdAt(LocalDateTime.now())
                                .build());
                    } catch (Exception ignored) {}
                }
                return item;
            }
        }
        if (entity.getQuantity() == null) {
            entity.setQuantity(BigDecimal.ZERO);
        }
        if (entity.getReservedQuantity() == null) {
            entity.setReservedQuantity(BigDecimal.ZERO);
        }
        InventoryItem created = super.create(entity);
        if (transactionService != null && created.getQuantity() != null && created.getQuantity().compareTo(BigDecimal.ZERO) > 0) {
            try {
                transactionService.create(InventoryTransaction.builder()
                        .inventoryItemId(created.getId())
                        .transactionType(InventoryTransactionType.ADD)
                        .quantity(created.getQuantity())
                        .createdAt(LocalDateTime.now())
                        .build());
            } catch (Exception ignored) {}
        }
        return created;
    }

    public InventoryItem adjustQuantity(String id, BigDecimal delta, String reason, String type, UUID userId) throws Exception {
        InventoryItem item = get(id).orElseThrow(() -> new IllegalArgumentException("Inventory item not found: " + id));
        BigDecimal current = item.getQuantity() == null ? BigDecimal.ZERO : item.getQuantity();
        BigDecimal newQty = current.add(delta);
        if (newQty.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Cannot remove more items than available in storage. Current: " + current + ", Requested to remove: " + delta.abs());
        }
        item.setQuantity(newQty);
        item.setUpdatedAt(LocalDateTime.now());
        update(item);

        if (transactionService != null && delta.compareTo(BigDecimal.ZERO) != 0) {
            try {
                InventoryTransactionType txType = delta.compareTo(BigDecimal.ZERO) > 0 ? InventoryTransactionType.ADD : InventoryTransactionType.SUBTRACT;
                if ("RESERVE".equalsIgnoreCase(type)) txType = InventoryTransactionType.RESERVE;
                if ("RELEASE".equalsIgnoreCase(type)) txType = InventoryTransactionType.RELEASE;

                transactionService.create(InventoryTransaction.builder()
                        .inventoryItemId(item.getId())
                        .transactionType(txType)
                        .quantity(delta.abs())
                        .createdBy(userId)
                        .referenceType(reason)
                        .createdAt(LocalDateTime.now())
                        .build());
            } catch (Exception ignored) {}
        }
        return item;
    }
}
