package com.disasterrelief.backend.ipfs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.MapType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Generic JSON document store backed by IPFS.
 *
 * Design:
 *  - Every entity is serialized to a JSON document, added to IPFS (content addressed),
 *    and pinned. The resulting CID is the immutable content reference.
 *  - A per-collection index document (an MFS file) maps stable application IDs to the
 *    CID of the latest revision: /disaster-relief/<collection>/index.json
 *  - A root index document maps collection name -> CID of the collection index, enabling
 *    discovery of everything stored in the app: /disaster-relief/index.json
 *
 * IPFS is not queryable, so these index documents provide deterministic discovery while
 * content stays immutable and verifiable by CID.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class IpfsStore {

    private final IpfsClient ipfsClient;
    private final ObjectMapper objectMapper;

    @Value("${app.ipfs.mfs-root:/disaster-relief}")
    private String mfsRoot;

    @Value("${app.ipfs.index-name:index.json}")
    private String indexName;

    private static final MapType STRING_STRING_MAP_TYPE =
            new ObjectMapper().getTypeFactory().constructMapType(LinkedHashMap.class, String.class, String.class);

    /**
     * Stores a document in the given collection under the given stable app ID.
     * Returns the immutable CID. Index documents are updated so the new revision
     * is discoverable.
     */
    public String save(String collection, String appId, byte[] json) throws IOException, InterruptedException {
        String cid = ipfsClient.add(json, appId + ".json");
        ipfsClient.pin(cid);

        Map<String, String> index = readIndex(collection);
        index.put(appId, cid);
        String indexCid = writeIndex(collection, index);

        updateRootIndex(collection, indexCid);
        log.debug("IPFS saved {}/{} -> {} (index {})", collection, appId, cid, indexCid);
        return cid;
    }

    /**
     * Loads the latest revision of a document by stable app ID, or empty.
     */
    public Optional<byte[]> load(String collection, String appId) throws IOException, InterruptedException {
        Map<String, String> index = readIndex(collection);
        String cid = index.get(appId);
        if (cid == null) {
            return Optional.empty();
        }
        return Optional.of(ipfsClient.cat(cid));
    }

    /**
     * Returns true if an entry exists for the given app ID.
     */
    public boolean exists(String collection, String appId) throws IOException, InterruptedException {
        return readIndex(collection).containsKey(appId);
    }

    /**
     * Returns the immutable CID currently referenced by an app ID, if present.
     */
    public Optional<String> cidOf(String collection, String appId) throws IOException, InterruptedException {
        return Optional.ofNullable(readIndex(collection).get(appId));
    }

    /**
     * Returns all stable app IDs in a collection.
     */
    public java.util.Set<String> keys(String collection) throws IOException, InterruptedException {
        return readIndex(collection).keySet();
    }

    /**
     * Returns all app ID -> CID mappings for a collection.
     */
    public Map<String, String> index(String collection) throws IOException, InterruptedException {
        return readIndex(collection);
    }

    /**
     * Removes an app ID from a collection's index (content itself stays pinned).
     */
    public void delete(String collection, String appId) throws IOException, InterruptedException {
        Map<String, String> index = readIndex(collection);
        if (index.remove(appId) != null) {
            String indexCid = writeIndex(collection, index);
            updateRootIndex(collection, indexCid);
        }
    }

    private Map<String, String> readIndex(String collection) throws IOException, InterruptedException {
        String path = collectionIndexPath(collection);
        try {
            byte[] raw = ipfsClient.mfsRead(path);
            Map<String, String> parsed = objectMapper.readValue(raw, STRING_STRING_MAP_TYPE);
            return new ConcurrentHashMap<>(parsed);
        } catch (IOException e) {
            if (e.getMessage() != null && e.getMessage().contains("does not exist")) {
                return new ConcurrentHashMap<>();
            }
            throw e;
        }
    }

    private String writeIndex(String collection, Map<String, String> index) throws IOException, InterruptedException {
        byte[] json = objectMapper.writeValueAsBytes(index);
        return ipfsClient.mfsWrite(collectionIndexPath(collection), json);
    }

    private void updateRootIndex(String collection, String collectionIndexCid) throws IOException, InterruptedException {
        Map<String, String> root = readRootIndex();
        root.put(collection, collectionIndexCid);
        byte[] json = objectMapper.writeValueAsBytes(root);
        ipfsClient.mfsWrite(rootIndexPath(), json);
    }

    private Map<String, String> readRootIndex() throws IOException, InterruptedException {
        try {
            byte[] raw = ipfsClient.mfsRead(rootIndexPath());
            Map<String, String> parsed = objectMapper.readValue(raw, STRING_STRING_MAP_TYPE);
            return new ConcurrentHashMap<>(parsed);
        } catch (IOException e) {
            if (e.getMessage() != null && e.getMessage().contains("does not exist")) {
                return new ConcurrentHashMap<>();
            }
            throw e;
        }
    }

    private String collectionIndexPath(String collection) {
        return mfsRoot + "/" + collection + "/" + indexName;
    }

    private String rootIndexPath() {
        return mfsRoot + "/" + indexName;
    }
}
