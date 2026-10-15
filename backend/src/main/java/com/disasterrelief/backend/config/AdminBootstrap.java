package com.disasterrelief.backend.config;

import com.disasterrelief.backend.model.Role;
import com.disasterrelief.backend.model.User;
import com.disasterrelief.backend.store.UserStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminBootstrap implements CommandLineRunner {

    private final UserStore userStore;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.initial-admin.email:#{null}}")
    private String initialAdminEmail;

    @Value("${app.initial-admin.password:#{null}}")
    private String initialAdminPassword;

    @Override
    public void run(String... args) {
        try {
            boolean adminExists = userStore.findAll().stream()
                    .anyMatch(user -> user.getRole() == Role.ADMIN);

            if (adminExists) {
                log.info("An ADMIN user already exists. Skipping bootstrap.");
                return;
            }

            if (initialAdminEmail == null || initialAdminPassword == null || initialAdminEmail.isBlank() || initialAdminPassword.isBlank()) {
                log.warn("No ADMIN user exists, and app.initial-admin.email or app.initial-admin.password is not set. No Admin created.");
                return;
            }

            User admin = User.builder()
                    .email(initialAdminEmail)
                    .passwordHash(passwordEncoder.encode(initialAdminPassword))
                    .fullName("System Administrator")
                    .role(Role.ADMIN)
                    .build();

            userStore.save(admin);
            log.info("Initial ADMIN user successfully created with email: {}", initialAdminEmail);

        } catch (Exception e) {
            log.error("Failed to execute initial admin bootstrap", e);
        }
    }
}
