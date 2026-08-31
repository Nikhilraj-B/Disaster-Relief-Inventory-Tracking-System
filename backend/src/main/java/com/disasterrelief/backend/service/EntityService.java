package com.disasterrelief.backend.service;

import com.disasterrelief.backend.store.DocumentStore;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Base CRUD service over an IPFS DocumentStore.
 * Concrete services supply the collection name and entity type; ids are UUIDs.
 */
public abstract class EntityService<T> {

    private final DocumentStore<T> store;

    protected EntityService(DocumentStoreFactory factory, String collection, Class<T> type) {
        this.store = factory.create(collection, type);
    }

    protected DocumentStore<T> store() {
        return store;
    }

    protected String newId() {
        return UUID.randomUUID().toString();
    }

    protected abstract String idOf(T entity);

    protected abstract void setId(T entity, String id);

    public T create(T entity) throws Exception {
        String id = newId();
        setId(entity, id);
        return store.save(id, entity);
    }

    public T update(T entity) throws Exception {
        String id = idOf(entity);
        if (id == null || !store.exists(id)) {
            throw new IllegalArgumentException("Entity not found for update: " + id);
        }
        return store.save(id, entity);
    }

    public Optional<T> get(String id) throws Exception {
        return store.findById(id);
    }

    public List<T> list() throws Exception {
        return store.findAll();
    }

    public boolean delete(String id) throws Exception {
        if (!store.exists(id)) {
            return false;
        }
        store.delete(id);
        return true;
    }

    public Optional<String> cidOf(String id) throws Exception {
        return store.cidOf(id);
    }

    /** Returns the authenticated user's email, or null. */
    protected String currentUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? null : auth.getName();
    }
}
