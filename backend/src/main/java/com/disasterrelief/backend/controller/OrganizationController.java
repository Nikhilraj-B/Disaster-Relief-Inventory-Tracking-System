package com.disasterrelief.backend.controller;

import com.disasterrelief.backend.model.Organization;
import com.disasterrelief.backend.service.EntityService;
import com.disasterrelief.backend.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
public class OrganizationController extends EntityController<Organization> {

    private final OrganizationService organizationService;

    @Override
    protected EntityService<Organization> service() {
        return organizationService;
    }

    @Override
    @PreAuthorize("hasAnyRole('GOVERNMENT_ADMIN')")
    public ResponseEntity<Organization> create(Organization entity) throws Exception {
        return super.create(entity);
    }

    @Override
    @PreAuthorize("hasAnyRole('GOVERNMENT_ADMIN')")
    public ResponseEntity<Organization> update(String id, Organization entity) throws Exception {
        return super.update(id, entity);
    }

    @Override
    @PreAuthorize("hasAnyRole('GOVERNMENT_ADMIN')")
    public ResponseEntity<Void> delete(String id) throws Exception {
        return super.delete(id);
    }
}
