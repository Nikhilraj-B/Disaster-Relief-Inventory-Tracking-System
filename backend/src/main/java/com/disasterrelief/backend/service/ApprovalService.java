package com.disasterrelief.backend.service;

import com.disasterrelief.backend.model.Approval;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class ApprovalService extends EntityService<Approval> {

    public ApprovalService(DocumentStoreFactory factory) {
        super(factory, "approvals", Approval.class);
    }

    @Override
    protected String idOf(Approval entity) {
        return entity.getId() == null ? null : entity.getId().toString();
    }

    @Override
    protected void setId(Approval entity, String id) {
        entity.setId(UUID.fromString(id));
    }

    public List<Approval> findBySupplyRequest(UUID supplyRequestId) throws Exception {
        return list().stream()
                .filter(a -> supplyRequestId.equals(a.getSupplyRequestId()))
                .toList();
    }
}
