package com.disasterrelief.backend.store;

/**
 * Marks entities that expose their IPFS content identifier.
 */
public interface HasCid {
    void setCid(String cid);
}
