package com.disasterrelief.backend.store;

import com.disasterrelief.backend.ipfs.IpfsStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Generic IPFS-backed document store for a single entity type.
 * Uses {@link IpfsStore} under the hood: each entity is a JSON document addressed
 * by CID, with an index document (app ID -> CID) for deterministic discovery.
 *
 * Entities stored with this store must expose a String id (see getId/setId).
 */
@Slf4j
public class DocumentStore<T> {

    private final IpfsStore ipfsStore;
    private final ObjectMapper objectMapper;
    private final String collection;
    private final Class<T> type;

    DocumentStore(IpfsStore ipfsStore, ObjectMapper objectMapper, String collection, Class<T> type) {
        this.ipfsStore = ipfsStore;
        this.objectMapper = objectMapper;
        this.collection = collection;
        this.type = type;
    }

    public T save(String id, T entity) throws Exception {
        byte[] json = objectMapper.writeValueAsBytes(entity);
        String cid = ipfsStore.save(collection, id, json);
        setId(entity, cid);
        return entity;
    }

    public Optional<T> findById(String id) throws Exception {
        Optional<byte[]> raw = ipfsStore.load(collection, id);
        if (raw.isEmpty()) {
            return Optional.empty();
        }
        T entity = objectMapper.readValue(raw.get(), type);
        String cid = ipfsStore.cidOf(collection, id).orElse(null);
        setId(entity, cid);
        return Optional.of(entity);
    }

    public boolean exists(String id) throws Exception {
        return ipfsStore.exists(collection, id);
    }

    public void delete(String id) throws Exception {
        ipfsStore.delete(collection, id);
    }

    public List<T> findAll() throws Exception {
        List<T> result = new ArrayList<>();
        for (String id : ipfsStore.keys(collection)) {
            findById(id).ifPresent(result::add);
        }
        return result;
    }

    public Optional<String> cidOf(String id) throws Exception {
        return ipfsStore.cidOf(collection, id);
    }

    @SuppressWarnings("unchecked")
    private void setId(T entity, String cid) {
        if (entity instanceof HasCid hasCid) {
            hasCid.setCid(cid);
        }
    }
}
