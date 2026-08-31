package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.model.Notification;
import com.disasterrelief.backend.service.EntityService;
import com.disasterrelief.backend.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Notifications for the authenticated user. */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<List<Notification>> myNotifications() throws Exception {
        return ResponseEntity.ok(notificationService.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Notification> get(@PathVariable String id) throws Exception {
        return notificationService.get(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Notification> markRead(@PathVariable String id) throws Exception {
        Notification n = notificationService.get(id).orElseThrow(() -> new IllegalArgumentException("Not found"));
        n.setRead(true);
        return ResponseEntity.ok(notificationService.update(n));
    }
}
