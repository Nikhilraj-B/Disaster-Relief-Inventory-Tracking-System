package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.model.Vehicle;
import com.disasterrelief.backend.service.EntityService;
import com.disasterrelief.backend.service.VehicleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/vehicles")
@RequiredArgsConstructor
public class VehicleController extends EntityController<Vehicle> {

    private final VehicleService vehicleService;

    @Override
    protected EntityService<Vehicle> service() {
        return vehicleService;
    }

    @Override
    @PreAuthorize("hasAnyRole('GOVERNMENT_ADMIN','WAREHOUSE_MANAGER','TRANSPORT_OFFICER')")
    public ResponseEntity<Vehicle> create(Vehicle entity) throws Exception {
        return super.create(entity);
    }

    @Override
    @PreAuthorize("hasAnyRole('GOVERNMENT_ADMIN','WAREHOUSE_MANAGER')")
    public ResponseEntity<Vehicle> update(String id, Vehicle entity) throws Exception {
        return super.update(id, entity);
    }
}
