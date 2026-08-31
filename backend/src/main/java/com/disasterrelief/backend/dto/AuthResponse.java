package com.disasterrelief.backend.dto;

import com.disasterrelief.backend.model.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String tokenType;
    private UUID userId;
    private String email;
    private String fullName;
    private Role role;
    private String walletAddress;
}
