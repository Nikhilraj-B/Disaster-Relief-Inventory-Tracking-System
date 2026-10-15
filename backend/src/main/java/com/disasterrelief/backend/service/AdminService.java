package com.disasterrelief.backend.service;

import com.disasterrelief.backend.blockchain.EthereumService;
import com.disasterrelief.backend.dto.AuthResponse;
import com.disasterrelief.backend.dto.CreateUserRequest;
import com.disasterrelief.backend.model.Role;
import com.disasterrelief.backend.model.User;
import com.disasterrelief.backend.security.JwtUtil;
import com.disasterrelief.backend.store.UserStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {

    private final UserStore userStore;
    private final PasswordEncoder passwordEncoder;
    private final EthereumService ethereumService;
    private final JwtUtil jwtUtil;
    private final FacilityService facilityService;

    public AuthResponse createUser(CreateUserRequest request) {
        boolean exists;
        try {
            exists = userStore.existsByEmail(request.getEmail());
        } catch (Exception e) {
            log.error("Failed to check email existence on IPFS", e);
            throw new RuntimeException("Failed to check email", e);
        }
        if (exists) {
            throw new RuntimeException("Email already registered: " + request.getEmail());
        }

        // Validate Solidity role mapping if wallet is provided
        if (request.getWalletAddress() != null && !request.getWalletAddress().isBlank()) {
            String solidityRole = mapToSolidityRole(request.getRole());
            if (solidityRole != null) {
                boolean hasRole = ethereumService.hasRole(solidityRole, request.getWalletAddress());
                if (!hasRole) {
                    throw new RuntimeException("Wallet " + request.getWalletAddress() + " does NOT have the on-chain " + solidityRole);
                }
            }
        }

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .role(request.getRole())
                .walletAddress(request.getWalletAddress())
                .facilityId(request.getFacilityId())
                .build();

        try {
            userStore.save(user);
        } catch (Exception e) {
            log.error("Failed to persist new user to IPFS", e);
            throw new RuntimeException("Failed to create user", e);
        }

        // If assigned to a camp or warehouse, update facility manager if applicable
        if (request.getFacilityId() != null && (user.getRole() == Role.CAMP_MANAGER || user.getRole() == Role.WAREHOUSE_MANAGER)) {
            try {
                facilityService.get(request.getFacilityId().toString()).ifPresent(f -> {
                    f.setManagerUserId(user.getId());
                    try {
                        facilityService.update(f);
                    } catch (Exception e) {
                        log.warn("Failed to set facility manager for {}", f.getId(), e);
                    }
                });
            } catch (Exception e) {
                log.warn("Failed to find facility for assignment: {}", request.getFacilityId(), e);
            }
        }

        String token = jwtUtil.generateToken(user);
        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .walletAddress(user.getWalletAddress())
                .facilityId(user.getFacilityId())
                .build();
    }

    public User assignFacility(java.util.UUID userId, java.util.UUID facilityId) {
        User user;
        try {
            user = userStore.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userId));
        } catch (Exception e) {
            throw new RuntimeException("Failed to load user: " + userId, e);
        }

        java.util.UUID prevFacilityId = user.getFacilityId();
        if (prevFacilityId != null && (user.getRole() == Role.CAMP_MANAGER || user.getRole() == Role.WAREHOUSE_MANAGER)) {
            try {
                facilityService.get(prevFacilityId.toString()).ifPresent(f -> {
                    if (user.getId().equals(f.getManagerUserId())) {
                        f.setManagerUserId(null);
                        try {
                            facilityService.update(f);
                        } catch (Exception e) {
                            log.warn("Failed to clear previous manager from facility {}", f.getId(), e);
                        }
                    }
                });
            } catch (Exception e) {
                log.warn("Failed to find previous facility: {}", prevFacilityId, e);
            }
        }

        user.setFacilityId(facilityId);
        if (facilityId != null && (user.getRole() == Role.CAMP_MANAGER || user.getRole() == Role.WAREHOUSE_MANAGER)) {
            try {
                facilityService.get(facilityId.toString()).ifPresent(f -> {
                    f.setManagerUserId(user.getId());
                    try {
                        facilityService.update(f);
                    } catch (Exception e) {
                        log.warn("Failed to update manager for facility {}", f.getId(), e);
                    }
                });
            } catch (Exception e) {
                log.warn("Failed to find facility for assignment: {}", facilityId, e);
            }
        }

        try {
            userStore.save(user);
        } catch (Exception e) {
            log.error("Failed to persist updated user", e);
            throw new RuntimeException("Failed to save user facility assignment", e);
        }
        return user;
    }

    private String mapToSolidityRole(Role role) {
        switch (role) {
            case ADMIN: return "ADMIN_ROLE";
            case WAREHOUSE_MANAGER: return "WAREHOUSE_ROLE";
            case CAMP_MANAGER: return "CAMP_ROLE";
            case TRANSPORT_OFFICER: return "TRANSPORT_ROLE";
            default: return null;
        }
    }
}
