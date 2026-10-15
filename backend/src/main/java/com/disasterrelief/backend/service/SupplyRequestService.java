package com.disasterrelief.backend.service;

import com.disasterrelief.backend.blockchain.BlockchainFunction;
import com.disasterrelief.backend.blockchain.EthereumService;
import com.disasterrelief.backend.blockchain.EthereumVerificationException;
import com.disasterrelief.backend.blockchain.VerificationResult;
import com.disasterrelief.backend.model.Approval;
import com.disasterrelief.backend.model.ApprovalStatus;
import com.disasterrelief.backend.model.SupplyRequest;
import com.disasterrelief.backend.model.SupplyRequestStatus;
import com.disasterrelief.backend.model.User;
import com.disasterrelief.backend.store.DocumentStoreFactory;
import com.disasterrelief.backend.store.UserStore;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Orchestrates the canonical supply chain workflow for SupplyRequest.
 *
 * status is the single source of truth. Allowed transitions mirror the smart
 * contract's state machine:
 *   NONE -> CREATED
 *   CREATED -> APPROVED | REJECTED
 *   APPROVED -> ACCEPTED | REJECTED
 *   ACCEPTED -> DISPATCHED
 *   DISPATCHED -> IN_TRANSIT
 *   IN_TRANSIT -> ARRIVED
 *   ARRIVED -> RECEIVED
 *   RECEIVED -> COMPLETED
 *
 * ML classification (NORMAL/ABNORMAL) is decision support and is set at creation
 * time by the ML service; it does NOT change workflow status.
 *
 * Blockchain: every mutation requires a transaction hash that is independently
 * verified against the smart contract by {@link EthereumService} BEFORE the
 * IPFS document is updated. A hash supplied by the frontend is never trusted;
 * it must correspond to a mined, successful contract call from the acting
 * user's wallet, encoding the right request id and resulting in the right
 * on-chain state. On verification failure the request is left unchanged.
 */
@Service
@Slf4j
public class SupplyRequestService extends EntityService<SupplyRequest> {

    private final ApprovalService approvalService;
    private final NotificationService notificationService;
    private final MlServiceClient mlServiceClient;
    private final FacilityService facilityService;
    private final InventoryItemService inventoryItemService;
    private final EthereumService ethereumService;
    private final UserStore userStore;
    private final ShipmentService shipmentService;
    private final VehicleService vehicleService;

    public SupplyRequestService(DocumentStoreFactory factory,
                                ApprovalService approvalService,
                                NotificationService notificationService,
                                MlServiceClient mlServiceClient,
                                FacilityService facilityService,
                                InventoryItemService inventoryItemService,
                                EthereumService ethereumService,
                                UserStore userStore,
                                ShipmentService shipmentService,
                                VehicleService vehicleService) {
        super(factory, "supplyRequests", SupplyRequest.class);
        this.approvalService = approvalService;
        this.notificationService = notificationService;
        this.mlServiceClient = mlServiceClient;
        this.facilityService = facilityService;
        this.inventoryItemService = inventoryItemService;
        this.ethereumService = ethereumService;
        this.userStore = userStore;
        this.shipmentService = shipmentService;
        this.vehicleService = vehicleService;
    }

    private static final Map<SupplyRequestStatus, SupplyRequestStatus> NEXT =
            Map.of(
                    SupplyRequestStatus.NONE, SupplyRequestStatus.CREATED,
                    SupplyRequestStatus.CREATED, SupplyRequestStatus.ACCEPTED,
                    SupplyRequestStatus.APPROVED, SupplyRequestStatus.ACCEPTED,
                    SupplyRequestStatus.ACCEPTED, SupplyRequestStatus.DISPATCHED,
                    SupplyRequestStatus.DISPATCHED, SupplyRequestStatus.IN_TRANSIT,
                    SupplyRequestStatus.IN_TRANSIT, SupplyRequestStatus.ARRIVED,
                    SupplyRequestStatus.ARRIVED, SupplyRequestStatus.RECEIVED,
                    SupplyRequestStatus.RECEIVED, SupplyRequestStatus.COMPLETED
            );

    /** Creates a request in CREATED status and attaches ML classification. */
    @Override
    public SupplyRequest create(SupplyRequest entity) throws Exception {
        if (entity.getId() == null) {
            setId(entity, newId());
        }
        String actorWallet = currentUserWallet();
        // createRequest must have been sent by this user's wallet with this requestId.
        VerificationResult vr = verify(entity.getTxHashCreate(), BlockchainFunction.CREATE_REQUEST,
                entity.getId(), actorWallet, SupplyRequestStatus.CREATED);
        entity.setTxHashCreate(entity.getTxHashCreate());
        entity.setStatus(SupplyRequestStatus.CREATED);
        entity.setUpdatedAt(LocalDateTime.now());
        entity.getTxHashes().put("CREATE", entity.getTxHashCreate());
        attachMlClassification(entity);
        store().save(idOf(entity), entity);
        notificationService.notify(entity.getCreatedBy(), "Supply request created: " + entity.getId());
        log.info("SupplyRequest {} created, verified on-chain (status {})", entity.getId(), vr.onChainStatus());
        return entity;
    }

    /** Verifies a blockchain transaction for the given request and transition. */
    private VerificationResult verify(String txHash, BlockchainFunction function, UUID requestId,
                                      String expectedActorWallet, SupplyRequestStatus expectedStatus) throws Exception {
        if (txHash == null || txHash.isBlank()) {
            throw new EthereumVerificationException("Missing transaction hash for " + function.signature());
        }
        return ethereumService.verify(txHash, ethereumService.configuredContractAddress(),
                ethereumService.configuredChainId(), EthereumService.bytes32FromUuid(requestId),
                expectedActorWallet, function, expectedStatus.ordinal());
    }

    /**
     * Blockchain-verified explicit transition used by role-specific actions.
     * Verifies the transaction against the contract and only then persists the
     * new status to IPFS. A fake / unrelated hash never changes the state.
     */
    public SupplyRequest transitionBlockchain(String id, java.util.Set<SupplyRequestStatus> expectedFroms,
                                              SupplyRequestStatus to, BlockchainFunction function,
                                              String txHash) throws Exception {
        SupplyRequest request = get(id).orElseThrow(() -> new IllegalArgumentException("Request not found: " + id));
        SupplyRequestStatus current = request.getStatus() == null ? SupplyRequestStatus.NONE : request.getStatus();
        if (!expectedFroms.contains(current)) {
            throw new IllegalStateException("Expected status in " + expectedFroms + " but was " + current);
        }
        String actorWallet = currentUserWallet();
        verify(txHash, function, request.getId(), actorWallet, to);
        request.setStatus(to);
        request.setUpdatedAt(LocalDateTime.now());
        request.getTxHashes().put(to.name(), txHash);
        store().save(id, request);
        log.info("SupplyRequest {} {} -> {} verified on-chain", id, current, to);
        return request;
    }

    public SupplyRequest transitionBlockchain(String id, SupplyRequestStatus expectedFrom,
                                              SupplyRequestStatus to, BlockchainFunction function,
                                              String txHash) throws Exception {
        return transitionBlockchain(id, java.util.Set.of(expectedFrom), to, function, txHash);
    }

    public SupplyRequest acceptBlockchain(String id, String txHashAccept, String txHashAssign,
                                          String transporterWallet) throws Exception {
        return acceptBlockchain(id, txHashAccept, txHashAssign, transporterWallet, null, null, null, null, null);
    }

    /**
     * Blockchain-verified accept: verifies the acceptRequest tx AND the
     * assignTransporter tx before moving APPROVED -> ACCEPTED on IPFS,
     * recording the accepting warehouse and driver assignment.
     */
    public SupplyRequest acceptBlockchain(String id, String txHashAccept, String txHashAssign,
                                          String transporterWallet, String warehouseIdStr,
                                          String vehicleIdStr, String driverName, String driverId,
                                          String transporterUserIdStr) throws Exception {
        SupplyRequest request = get(id).orElseThrow(() -> new IllegalArgumentException("Request not found: " + id));
        SupplyRequestStatus current = request.getStatus() == null ? SupplyRequestStatus.NONE : request.getStatus();
        if (current != SupplyRequestStatus.CREATED && current != SupplyRequestStatus.APPROVED) {
            throw new IllegalStateException("Expected status CREATED or APPROVED but was " + current);
        }
        String actorWallet = currentUserWallet();
        verify(txHashAccept, BlockchainFunction.ACCEPT_REQUEST, request.getId(), actorWallet, SupplyRequestStatus.ACCEPTED);
        if (txHashAssign != null && !txHashAssign.isBlank()) {
            if (transporterWallet == null || transporterWallet.isBlank()) {
                throw new EthereumVerificationException("assignTransporter txHash provided but transporterWallet missing");
            }
            VerificationResult assign = ethereumService.verify(txHashAssign,
                    ethereumService.configuredContractAddress(), ethereumService.configuredChainId(),
                    EthereumService.bytes32FromUuid(request.getId()), actorWallet,
                    BlockchainFunction.ASSIGN_TRANSPORTER, SupplyRequestStatus.ACCEPTED.ordinal());
            if (!transporterWallet.equalsIgnoreCase(assign.argAddress())) {
                throw new EthereumVerificationException("assignTransporter assigned " + assign.argAddress()
                        + " but expected transporter " + transporterWallet);
            }
            request.getTxHashes().put("ASSIGN_TRANSPORTER", txHashAssign);
        }

        // Identify accepting manager and warehouse
        String email = currentUserEmail();
        User actingUser = email != null ? userStore.findByEmail(email).orElse(null) : null;
        if (actingUser != null) {
            request.setAcceptedByManagerId(actingUser.getId());
        }

        UUID warehouseId = null;
        if (warehouseIdStr != null && !warehouseIdStr.isBlank()) {
            warehouseId = UUID.fromString(warehouseIdStr);
        } else if (actingUser != null && actingUser.getFacilityId() != null) {
            warehouseId = actingUser.getFacilityId();
        }
        if (warehouseId != null) {
            request.setWarehouseId(warehouseId);
        }

        UUID vehicleId = (vehicleIdStr != null && !vehicleIdStr.isBlank()) ? UUID.fromString(vehicleIdStr) : null;
        UUID transporterUserId = (transporterUserIdStr != null && !transporterUserIdStr.isBlank()) ? UUID.fromString(transporterUserIdStr) : null;

        if (vehicleId != null && vehicleService != null) {
            var vOpt = vehicleService.get(vehicleId.toString());
            if (vOpt.isPresent()) {
                var v = vOpt.get();
                if ((driverName == null || driverName.isBlank()) && v.getDriverName() != null) {
                    driverName = v.getDriverName();
                }
                if ((driverId == null || driverId.isBlank()) && v.getDriverId() != null) {
                    driverId = v.getDriverId();
                }
                if (transporterUserId == null && v.getTransportOfficerUserId() != null) {
                    transporterUserId = v.getTransportOfficerUserId();
                }
            }
        }

        request.setAssignedVehicleId(vehicleId);
        request.setAssignedDriverName(driverName);
        request.setAssignedDriverId(driverId);
        request.setAssignedTransporterId(transporterUserId);

        // Record or update shipment
        if (shipmentService != null && (vehicleId != null || transporterUserId != null)) {
            try {
                Optional<com.disasterrelief.backend.model.Shipment> existing = shipmentService.findBySupplyRequest(request.getId());
                com.disasterrelief.backend.model.Shipment shipment = existing.orElseGet(() ->
                        com.disasterrelief.backend.model.Shipment.builder().supplyRequestId(request.getId()).build());
                if (vehicleId != null) shipment.setVehicleId(vehicleId);
                if (transporterUserId != null) shipment.setTransporterUserId(transporterUserId);
                if (existing.isPresent()) {
                    shipmentService.update(shipment);
                } else {
                    shipmentService.create(shipment);
                }
            } catch (Exception e) {
                log.warn("Failed to create/update shipment on accept", e);
            }
        }

        request.setStatus(SupplyRequestStatus.ACCEPTED);
        request.setUpdatedAt(LocalDateTime.now());
        request.getTxHashes().put("ACCEPTED", txHashAccept);
        store().save(id, request);
        log.info("SupplyRequest {} {} -> ACCEPTED verified on-chain, warehouse: {}", id, current, warehouseId);
        return request;
    }

    /**
     * Transport Officer (or admin) assigns vehicle and driver to an already ACCEPTED supply request.
     * Optionally records the on-chain assignTransporter transaction hash if provided.
     */
    public SupplyRequest assignDriver(String id, String txHashAssign, String transporterWallet,
                                      String vehicleIdStr, String driverName, String driverId,
                                      String transporterUserIdStr) throws Exception {
        SupplyRequest request = get(id).orElseThrow(() -> new IllegalArgumentException("Request not found: " + id));
        if (request.getStatus() != SupplyRequestStatus.ACCEPTED) {
            throw new IllegalStateException("Driver can only be assigned to ACCEPTED requests, current status: " + request.getStatus());
        }
        String actorWallet = currentUserWallet();
        if (txHashAssign != null && !txHashAssign.isBlank()) {
            if (transporterWallet == null || transporterWallet.isBlank()) {
                throw new EthereumVerificationException("assignTransporter txHash provided but transporterWallet missing");
            }
            VerificationResult assign = ethereumService.verify(txHashAssign,
                    ethereumService.configuredContractAddress(), ethereumService.configuredChainId(),
                    EthereumService.bytes32FromUuid(request.getId()), actorWallet,
                    BlockchainFunction.ASSIGN_TRANSPORTER, SupplyRequestStatus.ACCEPTED.ordinal());
            if (!transporterWallet.equalsIgnoreCase(assign.argAddress())) {
                throw new EthereumVerificationException("assignTransporter assigned " + assign.argAddress()
                        + " but expected transporter " + transporterWallet);
            }
            request.getTxHashes().put("ASSIGN_TRANSPORTER", txHashAssign);
        }

        UUID vehicleId = (vehicleIdStr != null && !vehicleIdStr.isBlank()) ? UUID.fromString(vehicleIdStr) : null;
        UUID transporterUserId = (transporterUserIdStr != null && !transporterUserIdStr.isBlank()) ? UUID.fromString(transporterUserIdStr) : null;

        if (vehicleId != null && vehicleService != null) {
            var vOpt = vehicleService.get(vehicleId.toString());
            if (vOpt.isPresent()) {
                var v = vOpt.get();
                if ((driverName == null || driverName.isBlank()) && v.getDriverName() != null) {
                    driverName = v.getDriverName();
                }
                if ((driverId == null || driverId.isBlank()) && v.getDriverId() != null) {
                    driverId = v.getDriverId();
                }
                if (transporterUserId == null && v.getTransportOfficerUserId() != null) {
                    transporterUserId = v.getTransportOfficerUserId();
                }
            }
        }

        request.setAssignedVehicleId(vehicleId);
        request.setAssignedDriverName(driverName);
        request.setAssignedDriverId(driverId);
        request.setAssignedTransporterId(transporterUserId);

        if (shipmentService != null && (vehicleId != null || transporterUserId != null)) {
            try {
                Optional<com.disasterrelief.backend.model.Shipment> existing = shipmentService.findBySupplyRequest(request.getId());
                com.disasterrelief.backend.model.Shipment shipment = existing.orElseGet(() ->
                        com.disasterrelief.backend.model.Shipment.builder().supplyRequestId(request.getId()).build());
                if (vehicleId != null) shipment.setVehicleId(vehicleId);
                if (transporterUserId != null) shipment.setTransporterUserId(transporterUserId);
                if (existing.isPresent()) {
                    shipmentService.update(shipment);
                } else {
                    shipmentService.create(shipment);
                }
            } catch (Exception e) {
                log.warn("Failed to create/update shipment on assignDriver", e);
            }
        }

        request.setUpdatedAt(LocalDateTime.now());
        store().save(id, request);
        log.info("SupplyRequest {} assigned driver {} and vehicle {}", id, driverName, vehicleId);
        return request;
    }

    /**
     * Blockchain-verified reject. Uses rejectRequest (from CREATED) or
     * rejectApprovedRequest (from APPROVED) per the current status, then
     * persists REJECTED and an Approval decision on IPFS.
     */
    public SupplyRequest rejectBlockchain(String id, UUID approverUserId, String comments, String txHash) throws Exception {
        SupplyRequest request = get(id).orElseThrow(() -> new IllegalArgumentException("Request not found: " + id));
        SupplyRequestStatus current = request.getStatus() == null ? SupplyRequestStatus.NONE : request.getStatus();
        if (current != SupplyRequestStatus.CREATED && current != SupplyRequestStatus.APPROVED) {
            throw new IllegalStateException("Rejection only allowed from CREATED or APPROVED, was " + current);
        }
        BlockchainFunction function = current == SupplyRequestStatus.APPROVED
                ? BlockchainFunction.REJECT_APPROVED_REQUEST
                : BlockchainFunction.REJECT_REQUEST;
        String actorWallet = currentUserWallet();
        verify(txHash, function, request.getId(), actorWallet, SupplyRequestStatus.REJECTED);
        request.setStatus(SupplyRequestStatus.REJECTED);
        request.setUpdatedAt(LocalDateTime.now());
        request.getTxHashes().put("REJECTED", txHash);
        store().save(id, request);

        approvalService.create(Approval.builder()
                .supplyRequestId(request.getId())
                .approverUserId(approverUserId)
                .status(ApprovalStatus.REJECTED)
                .comments(comments)
                .txHash(txHash)
                .build());
        return request;
    }

    /** Resolves the acting user's linked wallet from the IPFS user record. */
    private String currentUserWallet() throws Exception {
        String email = currentUserEmail();
        if (email == null) {
            throw new EthereumVerificationException("Not authenticated");
        }
        User user = userStore.findByEmail(email)
                .orElseThrow(() -> new EthereumVerificationException("User not found: " + email));
        if (user.getWalletAddress() == null || user.getWalletAddress().isBlank()) {
            throw new EthereumVerificationException("No Ethereum wallet linked to account " + email
                    + "; connect MetaMask and link your wallet before blockchain actions");
        }
        return user.getWalletAddress();
    }

    /**
     * Gathers ML features from the linked camp facility and first item, calls the
     * ML service, and stores classification + confidence. Decision support only.
     */
    private void attachMlClassification(SupplyRequest entity) throws Exception {
        try {
            int population = 0;
            int capacity = 0;
            if (entity.getCampId() != null) {
                Optional<com.disasterrelief.backend.model.Facility> camp = facilityService.get(entity.getCampId().toString());
                if (camp.isPresent()) {
                    population = camp.get().getPopulation() == null ? 0 : camp.get().getPopulation();
                    capacity = camp.get().getMaxCapacity() == null ? 0 : camp.get().getMaxCapacity();
                }
            }

            double requestedQty = 0;
            String itemCategory = "Other";
            java.util.UUID reliefItemId = null;
            if (entity.getItems() != null && !entity.getItems().isEmpty()) {
                var first = entity.getItems().get(0);
                requestedQty = first.getRequestedQty() == null ? 0 : first.getRequestedQty().doubleValue();
                reliefItemId = first.getReliefItemId();
                if (first.getItemCategory() != null) {
                    itemCategory = titleCase(first.getItemCategory().name());
                }
            }

            // Current inventory of the requested item at the camp, and how often this
            // camp has requested this item before (historical frequency).
            final java.util.UUID fReliefItemId = reliefItemId;
            final java.util.UUID fCampId = entity.getCampId();
            double currentInventory = 0;
            int historicalFreq = 0;
            if (fCampId != null && fReliefItemId != null) {
                Optional<com.disasterrelief.backend.model.InventoryItem> inv =
                        inventoryItemService.findByFacilityAndItem(fCampId, fReliefItemId);
                if (inv.isPresent() && inv.get().getQuantity() != null) {
                    currentInventory = inv.get().getQuantity().doubleValue();
                }
                historicalFreq = (int) list().stream()
                        .filter(r -> fCampId.equals(r.getCampId()))
                        .filter(r -> r.getItems() != null)
                        .filter(r -> r.getItems().stream().anyMatch(i -> fReliefItemId.equals(i.getReliefItemId())))
                        .count();
            }

            MlServiceClient.MlResult result = mlServiceClient.classify(
                    requestedQty, itemCategory, population, capacity, currentInventory, historicalFreq
            );
            entity.setMlClassification(result.isAbnormal()
                    ? com.disasterrelief.backend.model.MlClassification.ABNORMAL
                    : com.disasterrelief.backend.model.MlClassification.NORMAL);
            entity.setMlConfidence(result.confidence());
            log.info("SupplyRequest {} ML classification: {} (confidence {})",
                    entity.getId(), entity.getMlClassification(), entity.getMlConfidence());
        } catch (Exception e) {
            log.error("ML classification failed for request {}, defaulting to ABNORMAL", entity.getId(), e);
            entity.setMlClassification(com.disasterrelief.backend.model.MlClassification.ABNORMAL);
            entity.setMlConfidence(BigDecimal.ZERO);
        }
    }

    private String titleCase(String name) {
        return name.substring(0, 1).toUpperCase() + name.substring(1).toLowerCase();
    }

    /** Advances a request by one valid transition. Rejects invalid jumps. */
    public SupplyRequest advance(String id) throws Exception {
        SupplyRequest request = get(id).orElseThrow(() -> new IllegalArgumentException("Request not found: " + id));
        SupplyRequestStatus current = request.getStatus() == null ? SupplyRequestStatus.NONE : request.getStatus();
        SupplyRequestStatus next = NEXT.get(current);
        if (next == null) {
            throw new IllegalStateException("No valid transition from status " + current);
        }
        request.setStatus(next);
        request.setUpdatedAt(LocalDateTime.now());
        store().save(id, request);
        log.info("SupplyRequest {} moved {} -> {}", id, current, next);
        return request;
    }

    @Override
    protected String idOf(SupplyRequest entity) {
        return entity.getId() == null ? null : entity.getId().toString();
    }

    @Override
    protected void setId(SupplyRequest entity, String id) {
        entity.setId(UUID.fromString(id));
    }
}
