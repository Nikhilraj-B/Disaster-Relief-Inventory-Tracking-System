package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.dto.CreateUserRequest;
import com.disasterrelief.backend.dto.AuthResponse;
import com.disasterrelief.backend.service.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @PostMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AuthResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.ok(adminService.createUser(request));
    }

    @PostMapping("/users/{userId}/assign-facility")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> assignFacility(@PathVariable String userId,
                                            @RequestBody(required = false) java.util.Map<String, String> body) {
        java.util.UUID facId = null;
        if (body != null && body.get("facilityId") != null && !body.get("facilityId").isBlank()) {
            facId = java.util.UUID.fromString(body.get("facilityId"));
        }
        var updated = adminService.assignFacility(java.util.UUID.fromString(userId), facId);
        return ResponseEntity.ok(new UsersController.UserView(
                updated.getId(),
                updated.getEmail(),
                updated.getFullName(),
                updated.getRole(),
                updated.getWalletAddress(),
                updated.getFacilityId()
        ));
    }
}
