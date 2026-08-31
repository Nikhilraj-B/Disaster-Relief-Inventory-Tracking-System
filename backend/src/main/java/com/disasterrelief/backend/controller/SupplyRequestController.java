package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.blockchain.BlockchainFunction;
import com.disasterrelief.backend.model.SupplyRequest;
import com.disasterrelief.backend.model.SupplyRequestStatus;
import com.disasterrelief.backend.service.EntityService;
import com.disasterrelief.backend.service.SupplyRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Supply request workflow endpoints. Status transitions are role-gated to mirror
 * the smart contract's actor authorization (CAMP creates, ADMIN approves,
 * WAREHOUSE accepts, TRANSPORT dispatches, CAMP receives/completes).
 *
 * Every mutation requires a transaction hash from the frontend (returned by the
 * signer after the corresponding contract call). The hash is independently
 * verified against the blockchain by EthereumService (see
 * SupplyRequestService.transitionBlockchain / acceptBlockchain / rejectBlockchain)
 * BEFORE the IPFS document is updated. A fake, wrong-contract, wrong-chain,
 * wrong-actor or reverted hash is rejected with 400 and leaves state unchanged.
 */
@RestController
@RequestMapping("/api/supply-requests")
@RequiredArgsConstructor
public class SupplyRequestController extends EntityController<SupplyRequest> {

    private final SupplyRequestService supplyRequestService;

    @Override
    protected EntityService<SupplyRequest> service() {
        return supplyRequestService;
    }

    @Override
    @PreAuthorize("hasAnyRole('CAMP_MANAGER','GOVERNMENT_ADMIN')")
    public ResponseEntity<SupplyRequest> create(SupplyRequest entity) throws Exception {
        return super.create(entity);
    }

    /** WAREHOUSE manager wallet, admin or warehouse links a transporter and accepts. */
    private static String body(Map<String, String> body, String key) {
        return body == null ? null : body.get(key);
    }

    /** ADMIN approves: CREATED -> APPROVED. */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('GOVERNMENT_ADMIN')")
    public ResponseEntity<SupplyRequest> approve(@PathVariable String id,
                                                 @RequestBody(required = false) Map<String, String> body) throws Exception {
        return ResponseEntity.ok(supplyRequestService.transitionBlockchain(id, SupplyRequestStatus.CREATED,
                SupplyRequestStatus.APPROVED, BlockchainFunction.APPROVE_REQUEST, body(body, "txHash")));
    }

    /** WAREHOUSE accepts: APPROVED -> ACCEPTED (acceptRequest + optional assignTransporter). */
    @PostMapping("/{id}/accept")
    @PreAuthorize("hasAnyRole('WAREHOUSE_MANAGER','GOVERNMENT_ADMIN')")
    public ResponseEntity<SupplyRequest> accept(@PathVariable String id,
                                                @RequestBody(required = false) Map<String, String> body) throws Exception {
        return ResponseEntity.ok(supplyRequestService.acceptBlockchain(id, body(body, "txHash"),
                body(body, "txHashAssign"), body(body, "transporterWallet")));
    }

    /** TRANSPORT dispatches: ACCEPTED -> DISPATCHED. */
    @PostMapping("/{id}/dispatch")
    @PreAuthorize("hasAnyRole('TRANSPORT_OFFICER','GOVERNMENT_ADMIN')")
    public ResponseEntity<SupplyRequest> dispatch(@PathVariable String id,
                                                  @RequestBody(required = false) Map<String, String> body) throws Exception {
        return ResponseEntity.ok(supplyRequestService.transitionBlockchain(id, SupplyRequestStatus.ACCEPTED,
                SupplyRequestStatus.DISPATCHED, BlockchainFunction.DISPATCH_REQUEST, body(body, "txHash")));
    }

    /** TRANSPORT marks in transit: DISPATCHED -> IN_TRANSIT. */
    @PostMapping("/{id}/in-transit")
    @PreAuthorize("hasAnyRole('TRANSPORT_OFFICER','GOVERNMENT_ADMIN')")
    public ResponseEntity<SupplyRequest> inTransit(@PathVariable String id,
                                                   @RequestBody(required = false) Map<String, String> body) throws Exception {
        return ResponseEntity.ok(supplyRequestService.transitionBlockchain(id, SupplyRequestStatus.DISPATCHED,
                SupplyRequestStatus.IN_TRANSIT, BlockchainFunction.MARK_IN_TRANSIT, body(body, "txHash")));
    }

    /** TRANSPORT marks arrived: IN_TRANSIT -> ARRIVED. */
    @PostMapping("/{id}/arrived")
    @PreAuthorize("hasAnyRole('TRANSPORT_OFFICER','GOVERNMENT_ADMIN')")
    public ResponseEntity<SupplyRequest> arrived(@PathVariable String id,
                                                 @RequestBody(required = false) Map<String, String> body) throws Exception {
        return ResponseEntity.ok(supplyRequestService.transitionBlockchain(id, SupplyRequestStatus.IN_TRANSIT,
                SupplyRequestStatus.ARRIVED, BlockchainFunction.MARK_ARRIVED, body(body, "txHash")));
    }

    /** CAMP receives: ARRIVED -> RECEIVED. */
    @PostMapping("/{id}/receive")
    @PreAuthorize("hasAnyRole('CAMP_MANAGER','GOVERNMENT_ADMIN')")
    public ResponseEntity<SupplyRequest> receive(@PathVariable String id,
                                                 @RequestBody(required = false) Map<String, String> body) throws Exception {
        return ResponseEntity.ok(supplyRequestService.transitionBlockchain(id, SupplyRequestStatus.ARRIVED,
                SupplyRequestStatus.RECEIVED, BlockchainFunction.RECEIVE_REQUEST, body(body, "txHash")));
    }

    /** CAMP completes: RECEIVED -> COMPLETED. */
    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('CAMP_MANAGER','GOVERNMENT_ADMIN')")
    public ResponseEntity<SupplyRequest> complete(@PathVariable String id,
                                                  @RequestBody(required = false) Map<String, String> body) throws Exception {
        return ResponseEntity.ok(supplyRequestService.transitionBlockchain(id, SupplyRequestStatus.RECEIVED,
                SupplyRequestStatus.COMPLETED, BlockchainFunction.COMPLETE_REQUEST, body(body, "txHash")));
    }

    /** ADMIN or WAREHOUSE rejects: CREATED/APPROVED -> REJECTED. */
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('GOVERNMENT_ADMIN','WAREHOUSE_MANAGER')")
    public ResponseEntity<SupplyRequest> reject(@PathVariable String id,
                                                @RequestBody(required = false) Map<String, String> body) throws Exception {
        UUID approver = body != null && body.get("approverUserId") != null
                ? UUID.fromString(body.get("approverUserId"))
                : null;
        String comments = body(body, "comments");
        String txHash = body(body, "txHash");
        return ResponseEntity.ok(supplyRequestService.rejectBlockchain(id, approver, comments, txHash));
    }

    /** Advances by one valid step (general-purpose, role-gated; no blockchain check). */
    @PostMapping("/{id}/advance")
    @PreAuthorize("hasAnyRole('GOVERNMENT_ADMIN')")
    public ResponseEntity<SupplyRequest> advance(@PathVariable String id) throws Exception {
        return ResponseEntity.ok(supplyRequestService.advance(id));
    }
}