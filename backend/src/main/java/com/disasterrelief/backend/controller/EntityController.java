package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.service.EntityService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Shared CRUD endpoints for IPFS-backed entities. Subclasses set the service.
 */
public abstract class EntityController<T> {

    protected abstract EntityService<T> service();

    @GetMapping
    public ResponseEntity<List<T>> list() throws Exception {
        return ResponseEntity.ok(service().list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<T> get(@PathVariable String id) throws Exception {
        return service().get(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<T> create(@RequestBody T entity) throws Exception {
        return ResponseEntity.ok(service().create(entity));
    }

    @PutMapping("/{id}")
    public ResponseEntity<T> update(@PathVariable String id, @RequestBody T entity) throws Exception {
        T updated = service().update(entity);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) throws Exception {
        return service().delete(id) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
