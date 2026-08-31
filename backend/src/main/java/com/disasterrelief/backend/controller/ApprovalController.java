package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.model.Approval;
import com.disasterrelief.backend.service.ApprovalService;
import com.disasterrelief.backend.service.EntityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/approvals")
@RequiredArgsConstructor
public class ApprovalController extends EntityController<Approval> {

    private final ApprovalService approvalService;

    @Override
    protected EntityService<Approval> service() {
        return approvalService;
    }

    @GetMapping("/by-request/{supplyRequestId}")
    public ResponseEntity<List<Approval>> byRequest(@PathVariable String supplyRequestId) throws Exception {
        return ResponseEntity.ok(approvalService.findBySupplyRequest(UUID.fromString(supplyRequestId)));
    }
}
