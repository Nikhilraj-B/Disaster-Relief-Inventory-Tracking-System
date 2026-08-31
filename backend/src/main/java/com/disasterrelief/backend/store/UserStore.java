package com.disasterrelief.backend.store;

import com.disasterrelief.backend.ipfs.IpfsStore;
import com.disasterrelief.backend.model.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * IPFS-backed persistence for users. Replaces the former Spring Data JPA repository.
 * Each user is a JSON document on IPFS; the users index document maps
 * user ID -> CID for deterministic discovery.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserStore {

    public static final String COLLECTION = "users";

    private final IpfsStore ipfsStore;
    private final ObjectMapper objectMapper;

    public User save(User user) throws IOException, InterruptedException {
        if (user.getId() == null) {
            user.setId(UUID.randomUUID());
        }
        user.touch();
        byte[] json = objectMapper.writeValueAsBytes(user);
        String cid = ipfsStore.save(COLLECTION, user.getId().toString(), json);
        user.setCid(cid);
        return user;
    }

    public Optional<User> findById(UUID id) throws IOException, InterruptedException {
        return loadById(id);
    }

    public Optional<User> findByEmail(String email) throws IOException, InterruptedException {
        return findAll().stream()
                .filter(u -> u.getEmail() != null && u.getEmail().equalsIgnoreCase(email))
                .findFirst();
    }

    public boolean existsByEmail(String email) throws IOException, InterruptedException {
        return findByEmail(email).isPresent();
    }

    public List<User> findAll() throws IOException, InterruptedException {
        List<User> users = new ArrayList<>();
        for (String id : ipfsStore.keys(COLLECTION)) {
            loadById(UUID.fromString(id)).ifPresent(users::add);
        }
        return users;
    }

    private Optional<User> loadById(UUID id) throws IOException, InterruptedException {
        return ipfsStore.load(COLLECTION, id.toString())
                .map(bytes -> {
                    try {
                        User user = objectMapper.readValue(bytes, User.class);
                        user.setCid(ipfsStore.cidOf(COLLECTION, id.toString()).orElse(null));
                        return user;
                    } catch (Exception e) {
                        log.error("Failed to deserialize user {}", id, e);
                        return null;
                    }
                });
    }
}
