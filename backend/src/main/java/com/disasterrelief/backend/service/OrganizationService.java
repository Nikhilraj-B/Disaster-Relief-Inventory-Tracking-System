package com.disasterrelief.backend.service;

import com.disasterrelief.backend.model.Organization;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import org.springframework.stereotype.Service;

@Service
public class OrganizationService extends EntityService<Organization> {

    public OrganizationService(DocumentStoreFactory factory) {
        super(factory, "organizations", Organization.class);
    }

    @Override
    protected String idOf(Organization entity) {
        return entity.getId() == null ? null : entity.getId().toString();
    }

    @Override
    protected void setId(Organization entity, String id) {
        entity.setId(java.util.UUID.fromString(id));
    }
}
