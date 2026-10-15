package com.disasterrelief.backend.service;

import com.disasterrelief.backend.dto.AuthResponse;
import com.disasterrelief.backend.dto.LoginRequest;
import com.disasterrelief.backend.dto.LoginRequest;
import com.disasterrelief.backend.model.User;
import com.disasterrelief.backend.security.JwtUtil;
import com.disasterrelief.backend.store.UserStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.util.UUID;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserStore userStore;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user;
        try {
            user = userStore.findByEmail(request.getEmail())
                    .orElseThrow(() -> new RuntimeException("User not found"));
        } catch (Exception e) {
            log.error("Failed to load user from IPFS during login", e);
            throw new RuntimeException("User not found", e);
        }

        return toResponse(user);
    }

    public AuthResponse register(com.disasterrelief.backend.dto.RegisterRequest request) {
        if (request.getRole() != com.disasterrelief.backend.model.Role.ADMIN) {
            throw new RuntimeException("Public registration is only allowed for Admin accounts.");
        }
        
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

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .role(request.getRole())
                .walletAddress(request.getWalletAddress())
                .build();

        try {
            userStore.save(user);
        } catch (Exception e) {
            log.error("Failed to persist new user to IPFS", e);
            throw new RuntimeException("Failed to register user", e);
        }

        return toResponse(user);
    }

    /**
     * Links the authenticated user's account to the connected MetaMask wallet.
     *
     * Security: the target user is resolved ONLY from the authenticated session
     * (SecurityContextHolder / JWT), never from the request body, so a caller
     * cannot attach a wallet to somebody else's account. The wallet address is
     * a public key reference only — no private keys are ever stored.
     */
    public AuthResponse linkWallet(String walletAddress) {
        String email = currentUserEmail();
        if (email == null) {
            throw new RuntimeException("Not authenticated");
        }
        User user;
        try {
            user = userStore.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found: " + email));
        } catch (Exception e) {
            log.error("Failed to load user from IPFS during wallet link", e);
            throw new RuntimeException("User not found", e);
        }
        user.setWalletAddress(walletAddress);
        try {
            userStore.save(user);
        } catch (Exception e) {
            log.error("Failed to persist wallet link on IPFS", e);
            throw new RuntimeException("Failed to link wallet", e);
        }
        log.info("Linked wallet {} to account {}", walletAddress, email);
        return toResponse(user);
    }

    private final FacilityService facilityService;

    private String currentUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? null : auth.getName();
    }

    private AuthResponse toResponse(User user) {
        UUID facilityId = user.getFacilityId();
        if (facilityId == null && facilityService != null && user.getId() != null) {
            try {
                for (var f : facilityService.list()) {
                    if (user.getId().equals(f.getManagerUserId())) {
                        facilityId = f.getId();
                        user.setFacilityId(facilityId);
                        userStore.save(user);
                        break;
                    }
                }
            } catch (Exception ignored) {}
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
                .facilityId(facilityId)
                .build();
    }
}
