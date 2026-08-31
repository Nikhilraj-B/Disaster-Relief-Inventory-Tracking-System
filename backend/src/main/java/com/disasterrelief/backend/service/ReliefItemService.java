package com.disasterrelief.backend.service;

import com.disasterrelief.backend.model.ReliefItem;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class ReliefItemService extends EntityService<ReliefItem> {

    public ReliefItemService(DocumentStoreFactory factory) {
        super(factory, "reliefItems", ReliefItem.class);
    }

    @Override
    protected String idOf(ReliefItem entity) {
        return entity.getId() == null ? null : entity.getId().toString();
    }

    @Override
    protected void setId(ReliefItem entity, String id) {
        entity.setId(UUID.fromString(id));
    }
}
