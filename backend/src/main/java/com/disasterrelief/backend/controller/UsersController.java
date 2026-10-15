package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.dto.AuthResponse;
import com.disasterrelief.backend.dto.LinkWalletRequest;
import com.disasterrelief.backend.model.Role;
import com.disasterrelief.backend.model.User;
import com.disasterrelief.backend.service.AuthService;
import com.disasterrelief.backend.service.FacilityService;
import com.disasterrelief.backend.store.UserStore;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Minimal read-only directory of users and their linked wallet addresses.
 * The frontend needs this to resolve the warehouse manager / transport officer
 * wallet when signing contract transactions (e.g. createRequest's warehouse
 * argument, assignTransporter's transporter argument). Only identity + wallet
 * fields are exposed; the password hash is never serialized.
 *
 * Also hosts the authenticated wallet-linking endpoint: a logged-in user can
 * attach their connected MetaMask wallet to their OWN account (the account is
 * resolved from the JWT session, never from an id in the request body).
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UsersController {

    private final UserStore userStore;
    private final FacilityService facilityService;

    /** Sanitized user view: identity + wallet only, never credentials. */
    public record UserView(UUID id, String email, String fullName, Role role, String walletAddress, UUID facilityId) {}

    @GetMapping
    public List<UserView> list() {
        try {
            var facilities = facilityService != null ? facilityService.list() : List.<com.disasterrelief.backend.model.Facility>of();
            return userStore.findAll().stream()
                    .map(u -> {
                        UUID facId = u.getFacilityId();
                        if (facId == null && u.getId() != null) {
                            facId = facilities.stream()
                                    .filter(f -> u.getId().equals(f.getManagerUserId()))
                                    .map(com.disasterrelief.backend.model.Facility::getId)
                                    .findFirst()
                                    .orElse(null);
                        }
                        return new UserView(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.getWalletAddress(), facId);
                    })
                    .toList();
        } catch (Exception e) {
            throw new RuntimeException("Failed to load users", e);
        }
    }


}
