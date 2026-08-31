package com.disasterrelief.backend.testutil;

import com.disasterrelief.backend.ipfs.IpfsClient;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory {@link IpfsClient} test fake, used by tests that exercise the
 * {@code IpfsStore}/{@code UserStore} layers without requiring a live Kubo
 * daemon. Content is addressed by a SHA-256 based fake CID; MFS is emulated
 * with a path -> CID map. Error messages deliberately mirror the real client
 * (e.g. "...does not exist") so {@code IpfsStore}'s index-recovery behaviour
 * is exercised exactly as against a real node.
 *
 * This is a hand-written fake - no mockito/bytebuddy - so it runs unchanged
 * under JDK 25.
 */
public class InMemoryIpfsClient extends IpfsClient {

    private final Map<String, byte[]> contentByCid = new ConcurrentHashMap<>();
    private final Map<String, String> mfsPathToCid = new ConcurrentHashMap<>();

    public InMemoryIpfsClient() {
        super("http://127.0.0.1:5001/api/v0", new ObjectMapper());
    }

    @Override
    public String add(byte[] content, String filename) throws IOException {
        String cid = cidFor(content);
        contentByCid.put(cid, content);
        return cid;
    }

    @Override
    public byte[] cat(String cid) throws IOException {
        byte[] bytes = contentByCid.get(cid);
        if (bytes == null) {
            throw new IOException("IPFS cat failed for " + cid + ": HTTP 500");
        }
        return bytes;
    }

    @Override
    public void pin(String cid) {
        // Pinning is a no-op for an in-memory node.
    }

    @Override
    public String mfsWrite(String path, byte[] content) throws IOException {
        String cid = cidFor(content);
        contentByCid.put(cid, content);
        mfsPathToCid.put(path, cid);
        return cid;
    }

    @Override
    public byte[] mfsRead(String path) throws IOException {
        String cid = mfsPathToCid.get(path);
        if (cid == null) {
            throw new IOException("IPFS MFS read failed for " + path + ": file does not exist");
        }
        return cat(cid);
    }

    @Override
    public String mfsStat(String path) throws IOException {
        String cid = mfsPathToCid.get(path);
        if (cid == null) {
            throw new IOException("IPFS MFS stat failed for " + path + ": file does not exist");
        }
        return cid;
    }

    @Override
    public Map<String, String> mfsLs(String path) {
        return Map.of();
    }

    /** All content is visible, including the index documents written by IpfsStore. */
    public boolean hasPath(String path) {
        return mfsPathToCid.containsKey(path);
    }

    public byte[] rawAtPath(String path) throws IOException {
        return mfsRead(path);
    }

    private static String cidFor(byte[] content) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content);
            StringBuilder sb = new StringBuilder("Qm");
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IOException("SHA-256 unavailable", e);
        }
    }
}
