package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.model.Facility;
import com.disasterrelief.backend.service.EntityService;
import com.disasterrelief.backend.service.FacilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/facilities")
@RequiredArgsConstructor
public class FacilityController extends EntityController<Facility> {

    private final FacilityService facilityService;

    @Override
    protected EntityService<Facility> service() {
        return facilityService;
    }

    @Override
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE_MANAGER')")
    public ResponseEntity<Facility> create(Facility entity) throws Exception {
        return super.create(entity);
    }

    @Override
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE_MANAGER')")
    public ResponseEntity<Facility> update(String id, Facility entity) throws Exception {
        return super.update(id, entity);
    }
}
