package com.disasterrelief.backend.service;

import com.disasterrelief.backend.model.Notification;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class NotificationService extends EntityService<Notification> {

    public NotificationService(DocumentStoreFactory factory) {
        super(factory, "notifications", Notification.class);
    }

    @Override
    protected String idOf(Notification entity) {
        return entity.getId() == null ? null : entity.getId().toString();
    }

    @Override
    protected void setId(Notification entity, String id) {
        entity.setId(UUID.fromString(id));
    }

    public List<Notification> findForUser(UUID userId) throws Exception {
        return list().stream()
                .filter(n -> userId.equals(n.getUserId()))
                .toList();
    }

    public void notify(UUID userId, String message) throws Exception {
        create(Notification.builder().userId(userId).message(message).build());
    }
}
