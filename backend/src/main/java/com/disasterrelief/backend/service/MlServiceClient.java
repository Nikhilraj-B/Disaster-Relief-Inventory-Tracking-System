package com.disasterrelief.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Client for the FastAPI ML service.
 *
 * Decision-support only: the classification (NORMAL/ABNORMAL) is analytical and
 * never treated as blockchain workflow state. Per the design, if the ML service
 * is unreachable or fails, this defaults to ABNORMAL with confidence 0.0 so that
 * safety wins (forces manual government review) instead of auto-approving.
 */
@Service
@Slf4j
public class MlServiceClient {

    public record MlResult(String classification, BigDecimal confidence) {
        public boolean isAbnormal() {
            return "ABNORMAL".equalsIgnoreCase(classification);
        }
    }

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String mlServiceUrl;

    public MlServiceClient(@Value("${app.ml.service.url}") String mlServiceUrl, ObjectMapper objectMapper) {
        this.mlServiceUrl = mlServiceUrl;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    /**
     * Calls the ML service synchronously. Never throws: falls back to ABNORMAL/0.0.
     */
    public MlResult classify(double requestedQty, String itemCategory, int campPopulation,
                             int campCapacity, double currentInventory, int historicalFreq) {
        try {
            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("requested_qty", requestedQty);
            payload.put("item_category", itemCategory);
            payload.put("camp_population", campPopulation);
            payload.put("camp_capacity", campCapacity);
            payload.put("current_inventory", currentInventory);
            payload.put("historical_freq", historicalFreq);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(mlServiceUrl))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("ML service returned HTTP {}: {}", response.statusCode(), response.body());
                return fallback();
            }

            JsonNode node = objectMapper.readTree(response.body());
            String classification = node.path("classification").asText("ABNORMAL");
            double confidence = node.path("confidence").asDouble(0.0);
            return new MlResult(classification, BigDecimal.valueOf(confidence));
        } catch (Exception e) {
            log.warn("ML service unavailable ({}), defaulting to ABNORMAL/0.0", e.getMessage());
            return fallback();
        }
    }

    private MlResult fallback() {
        return new MlResult("ABNORMAL", BigDecimal.ZERO);
    }
}
