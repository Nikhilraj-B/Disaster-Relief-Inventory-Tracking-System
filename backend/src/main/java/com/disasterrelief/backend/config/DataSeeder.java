package com.disasterrelief.backend.config;

import com.disasterrelief.backend.model.Role;
import com.disasterrelief.backend.model.User;
import com.disasterrelief.backend.store.UserStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;

/**
 * Seeds default system users on first startup by storing them on IPFS.
 * In production, change these passwords immediately or disable this seeder.
 *
 * For the local Hardhat demonstration, each seeded role user is linked, when
 * possible, to the deployed role account from blockchain/deployments/localhost.json
 * (the deterministic Hardhat accounts that were granted the contract roles).
 * This lets the app work end-to-end out of the box. An explicitly linked
 * wallet is never overwritten; the backfill only fills empty walletAddress
 * fields. Users can always relink their own wallet via PUT /api/users/me/wallet.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final UserStore userStore;
    private final PasswordEncoder passwordEncoder;

    /** Deployed role accounts (see blockchain/deployments/localhost.json). */
    private static final Map<Role, String> ROLE_WALLETS = Map.of(
            Role.GOVERNMENT_ADMIN, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            Role.WAREHOUSE_MANAGER, "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            Role.CAMP_MANAGER, "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            Role.TRANSPORT_OFFICER, "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
    );

    @Override
    public void run(String... args) {
        try {
            seedUser("admin@disasterrelief.gov", "Admin1234!", "Government Administrator", Role.GOVERNMENT_ADMIN);
            seedUser("warehouse@disasterrelief.gov", "Warehouse1234!", "Warehouse Manager", Role.WAREHOUSE_MANAGER);
            seedUser("camp@disasterrelief.gov", "Camp1234!", "Camp Manager", Role.CAMP_MANAGER);
            seedUser("ngo@disasterrelief.gov", "Ngo1234!", "NGO Coordinator", Role.NGO_COORDINATOR);
            seedUser("transport@disasterrelief.gov", "Transport1234!", "Transport Officer", Role.TRANSPORT_OFFICER);
            log.info("DataSeeder: seed complete.");
        } catch (Exception e) {
            log.error("DataSeeder failed", e);
        }
    }

    private void seedUser(String email, String password, String fullName, Role role) throws Exception {
        Optional<User> existing = userStore.findByEmail(email);
        String demoWallet = ROLE_WALLETS.get(role);

        if (existing.isPresent()) {
            User user = existing.get();
            if (user.getWalletAddress() == null || user.getWalletAddress().isBlank()) {
                if (demoWallet != null) {
                    user.setWalletAddress(demoWallet);
                    userStore.save(user);
                    log.info("Backfilled wallet for seed user {} -> {}", email, demoWallet);
                } else {
                    log.info("Seed user {} has no linked wallet (role {} has no demo account)", email, role);
                }
            }
            return;
        }

        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .fullName(fullName)
                .role(role)
                .walletAddress(demoWallet)
                .build();
        userStore.save(user);
        log.info("Seeded user: {} ({})", email, role);
    }
}