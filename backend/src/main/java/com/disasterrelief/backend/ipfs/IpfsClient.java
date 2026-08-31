package com.disasterrelief.backend.ipfs;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Minimal HTTP client for a Kubo (go-ipfs) RPC API.
 * Provides the operations the application needs: add (multipart upload),
 * cat (fetch by CID), pin, and MFS (files) operations for index documents.
 * No external library is required - java.net.http.HttpClient is used.
 *
 * The Kubo RPC API must be reachable at app.ipfs.api-url (default http://127.0.0.1:5001/api/v0).
 */
@Component
public class IpfsClient {

    public static final String MIME_JSON = "application/json";
    private static final String BOUNDARY_PREFIX = "----DisasterReliefBoundary";

    private final HttpClient httpClient;
    private final String apiBaseUrl;
    private final ObjectMapper objectMapper;

    public IpfsClient(@Value("${app.ipfs.api-url}") String apiBaseUrl, ObjectMapper objectMapper) {
        this.apiBaseUrl = apiBaseUrl.replaceAll("/+$", "");
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    /**
     * Adds raw bytes to IPFS via a multipart upload and returns the resulting CID.
     * The node keeps a local copy of added content automatically; callers may
     * additionally pin to be safe (see {@link #pin(String)}).
     */
    public String add(byte[] content, String filename) throws IOException, InterruptedException {
        String boundary = BOUNDARY_PREFIX + UUID.randomUUID().toString().replace("-", "");
        byte[] body = buildMultipartBody(boundary, "file", filename, content);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiBaseUrl + "/add"))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("IPFS add failed: HTTP " + response.statusCode() + " " + response.body());
        }

        // Response is one JSON object per line: {"Name":..., "Hash":..., "Size":...}
        String lastLine = response.body().trim();
        if (lastLine.isEmpty()) {
            throw new IOException("IPFS add returned empty response");
        }
        if (lastLine.contains("\n")) {
            String[] lines = lastLine.split("\n");
            lastLine = lines[lines.length - 1];
        }
        JsonNode node = objectMapper.readTree(lastLine);
        String cid = node.path("Hash").asText(null);
        if (cid == null || cid.isEmpty()) {
            throw new IOException("IPFS add response missing Hash: " + lastLine);
        }
        return cid;
    }

    /**
     * Fetches content stored at the given CID.
     * Note: Kubo requires POST for /cat (GET returns 405).
     */
    public byte[] cat(String cid) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiBaseUrl + "/cat?arg=" + encode(cid)))
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) {
            throw new IOException("IPFS cat failed for " + cid + ": HTTP " + response.statusCode());
        }
        return response.body();
    }

    /**
     * Pins a CID so the local node guarantees to retain the content.
     */
    public void pin(String cid) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiBaseUrl + "/pin/add?arg=" + encode(cid)))
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("IPFS pin failed for " + cid + ": HTTP " + response.statusCode() + " " + response.body());
        }
    }

    // --- MFS (Mutable File System) operations for index documents ---

    /**
     * Writes a file into the node's MFS at the given path (creating parent dirs).
     * MFS gives a stable, mutable path on top of immutable content - ideal for
     * an application index document whose CID changes on every update.
     */
    public String mfsWrite(String path, byte[] content) throws IOException, InterruptedException {
        String boundary = BOUNDARY_PREFIX + UUID.randomUUID().toString().replace("-", "");
        byte[] body = buildMultipartBody(boundary, "data", "data", content);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiBaseUrl + "/files/write?arg=" + encode(path)
                        + "&create=true&parents=true&truncate=true"))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("IPFS MFS write failed for " + path + ": HTTP " + response.statusCode() + " " + response.body());
        }
        return mfsStat(path);
    }

    /**
     * Reads a file from MFS at the given path. Throws if it does not exist.
     * Note: Kubo requires POST for /files/read (GET returns 405).
     */
    public byte[] mfsRead(String path) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiBaseUrl + "/files/read?arg=" + encode(path)))
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) {
            byte[] errBody = response.body();
            String err = errBody == null ? "" : new String(errBody, StandardCharsets.UTF_8);
            if (err.contains("does not exist")) {
                throw new IOException("IPFS MFS read failed for " + path + ": file does not exist");
            }
            throw new IOException("IPFS MFS read failed for " + path + ": HTTP " + response.statusCode());
        }
        byte[] body = response.body();
        if (body.length > 0) {
            String text = new String(body, StandardCharsets.UTF_8);
            if (text.contains("\"Type\":\"error\"") && text.contains("does not exist")) {
                throw new IOException("IPFS MFS read failed for " + path + ": file does not exist");
            }
        }
        return body;
    }

    /**
     * Returns the CID backing an MFS path. Throws if the path does not exist.
     */
    public String mfsStat(String path) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiBaseUrl + "/files/stat?arg=" + encode(path)))
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("IPFS MFS stat failed for " + path + ": HTTP " + response.statusCode() + " " + response.body());
        }
        JsonNode node = objectMapper.readTree(response.body());
        return node.path("Hash").asText(null);
    }

    /**
     * Lists entries in an MFS directory. Returns an empty map if the directory
     * does not exist.
     */
    public Map<String, String> mfsLs(String path) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiBaseUrl + "/files/ls?arg=" + encode(path)))
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            return Map.of();
        }
        JsonNode node = objectMapper.readTree(response.body());
        JsonNode entries = node.path("Entries");
        Map<String, String> result = new java.util.LinkedHashMap<>();
        if (entries.isArray()) {
            for (JsonNode entry : entries) {
                result.put(entry.path("Name").asText(), entry.path("Type").asText());
            }
        }
        return result;
    }

    private byte[] buildMultipartBody(String boundary, String fieldName, String filename, byte[] content) throws IOException {
        String header = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + MIME_JSON + "\r\n\r\n";
        String footer = "\r\n--" + boundary + "--\r\n";
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        out.write(header.getBytes(StandardCharsets.UTF_8));
        out.write(content);
        out.write(footer.getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
