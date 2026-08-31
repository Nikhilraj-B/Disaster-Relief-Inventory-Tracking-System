package com.disasterrelief.backend.security;

import com.disasterrelief.backend.store.UserStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Loads users for Spring Security authentication from the IPFS-backed UserStore.
 * Implemented as a standalone component (not a SecurityConfig @Bean) to avoid a
 * circular dependency: JwtAuthFilter -> UserDetailsService -> SecurityConfig
 * -> JwtAuthFilter.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserStore userStore;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        try {
            return userStore.findByEmail(email)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
        } catch (Exception e) {
            log.error("Failed to load user {} from IPFS", email, e);
            throw new UsernameNotFoundException("User not found: " + email, e);
        }
    }
}
