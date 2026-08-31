package com.disasterrelief.backend.store;

import com.disasterrelief.backend.ipfs.IpfsStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Factory for typed IPFS document stores keyed by collection name.
 */
@Component
@RequiredArgsConstructor
public class DocumentStoreFactory {

    private final IpfsStore ipfsStore;
    private final ObjectMapper objectMapper;

    public <T> DocumentStore<T> create(String collection, Class<T> type) {
        return new DocumentStore<>(ipfsStore, objectMapper, collection, type);
    }
}
