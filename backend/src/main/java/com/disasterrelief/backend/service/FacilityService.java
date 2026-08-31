package com.disasterrelief.backend.service;

import com.disasterrelief.backend.model.Facility;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class FacilityService extends EntityService<Facility> {

    public FacilityService(DocumentStoreFactory factory) {
        super(factory, "facilities", Facility.class);
    }

    @Override
    protected String idOf(Facility entity) {
        return entity.getId() == null ? null : entity.getId().toString();
    }

    @Override
    protected void setId(Facility entity, String id) {
        entity.setId(UUID.fromString(id));
    }
}
