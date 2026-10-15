package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.model.InventoryItem;
import com.disasterrelief.backend.service.EntityService;
import com.disasterrelief.backend.service.InventoryItemService;
import com.disasterrelief.backend.store.UserStore;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.UUID;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryItemController extends EntityController<InventoryItem> {

    private final InventoryItemService inventoryItemService;
    private final UserStore userStore;

    @Override
    protected EntityService<InventoryItem> service() {
        return inventoryItemService;
    }

    @Override
    @PostMapping
    @PreAuthorize("hasAnyRole('WAREHOUSE_MANAGER','CAMP_MANAGER','ADMIN')")
    public ResponseEntity<InventoryItem> create(@RequestBody InventoryItem entity) throws Exception {
        return super.create(entity);
    }

    @Override
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('WAREHOUSE_MANAGER','CAMP_MANAGER','ADMIN')")
    public ResponseEntity<InventoryItem> update(@PathVariable String id, @RequestBody InventoryItem entity) throws Exception {
        return super.update(id, entity);
    }

    @Override
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('WAREHOUSE_MANAGER','CAMP_MANAGER','ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String id) throws Exception {
        return super.delete(id);
    }

    public record AdjustRequest(BigDecimal delta, String reason, String type) {}

    @PostMapping("/{id}/adjust")
    @PreAuthorize("hasAnyRole('WAREHOUSE_MANAGER','CAMP_MANAGER','ADMIN')")
    public ResponseEntity<InventoryItem> adjust(
            @PathVariable String id,
            @RequestBody AdjustRequest request) throws Exception {
        UUID userId = null;
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null) {
            userId = userStore.findByEmail(auth.getName())
                    .map(com.disasterrelief.backend.model.User::getId)
                    .orElse(null);
        }
        return ResponseEntity.ok(inventoryItemService.adjustQuantity(
                id,
                request.delta() != null ? request.delta() : BigDecimal.ZERO,
                request.reason(),
                request.type(),
                userId
        ));
    }
}
