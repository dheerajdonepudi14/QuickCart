package com.quickcommerce.security;

import com.quickcommerce.entity.Role;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.security.Principal;
import java.util.Collection;
import java.util.List;

/** Lightweight authenticated identity rebuilt from JWT claims (no DB round-trip per request). */
public record UserPrincipal(Long id, String email, Role role, Long storeId) implements Principal {

    public Collection<? extends GrantedAuthority> authorities() {
        return List.of(new SimpleGrantedAuthority(role.name()));
    }

    public boolean isStoreAdmin() { return role == Role.ROLE_STORE_ADMIN; }

    public boolean isDeliveryPartner() { return role == Role.ROLE_DELIVERY_PARTNER; }

    /** Store admins without a store manage every store. */
    public boolean canManageStore(Long targetStoreId) {
        return isStoreAdmin() && (storeId == null || storeId.equals(targetStoreId));
    }

    @Override
    public String getName() { return String.valueOf(id); }
}
