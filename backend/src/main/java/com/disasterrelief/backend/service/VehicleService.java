package com.disasterrelief.backend.service;

import com.disasterrelief.backend.model.Vehicle;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class VehicleService extends EntityService<Vehicle> {

    public VehicleService(DocumentStoreFactory factory) {
        super(factory, "vehicles", Vehicle.class);
    }

    @Override
    protected String idOf(Vehicle entity) {
        return entity.getId() == null ? null : entity.getId().toString();
    }

    @Override
    protected void setId(Vehicle entity, String id) {
        entity.setId(UUID.fromString(id));
    }
}
