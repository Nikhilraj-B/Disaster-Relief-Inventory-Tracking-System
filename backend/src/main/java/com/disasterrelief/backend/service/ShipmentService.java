package com.disasterrelief.backend.service;

import com.disasterrelief.backend.model.Shipment;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class ShipmentService extends EntityService<Shipment> {

    public ShipmentService(DocumentStoreFactory factory) {
        super(factory, "shipments", Shipment.class);
    }

    @Override
    protected String idOf(Shipment entity) {
        return entity.getId() == null ? null : entity.getId().toString();
    }

    @Override
    protected void setId(Shipment entity, String id) {
        entity.setId(UUID.fromString(id));
    }

    public Optional<Shipment> findBySupplyRequest(UUID supplyRequestId) throws Exception {
        return list().stream()
                .filter(s -> supplyRequestId.equals(s.getSupplyRequestId()))
                .findFirst();
    }
}
