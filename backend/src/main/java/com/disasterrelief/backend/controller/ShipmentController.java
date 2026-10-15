package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.model.Shipment;
import com.disasterrelief.backend.service.EntityService;
import com.disasterrelief.backend.service.ShipmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/shipments")
@RequiredArgsConstructor
public class ShipmentController extends EntityController<Shipment> {

    private final ShipmentService shipmentService;

    @Override
    protected EntityService<Shipment> service() {
        return shipmentService;
    }

    @GetMapping("/by-request/{supplyRequestId}")
    public ResponseEntity<Shipment> byRequest(@PathVariable String supplyRequestId) throws Exception {
        return shipmentService.findBySupplyRequest(UUID.fromString(supplyRequestId))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Override
    @PreAuthorize("hasAnyRole('WAREHOUSE_MANAGER','TRANSPORT_OFFICER','ADMIN')")
    public ResponseEntity<Shipment> create(Shipment entity) throws Exception {
        return super.create(entity);
    }

    @Override
    @PreAuthorize("hasAnyRole('WAREHOUSE_MANAGER','TRANSPORT_OFFICER','ADMIN')")
    public ResponseEntity<Shipment> update(String id, Shipment entity) throws Exception {
        return super.update(id, entity);
    }
}
