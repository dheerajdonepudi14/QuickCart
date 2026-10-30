package com.quickcommerce.security;

import com.quickcommerce.exception.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

public final class CurrentUser {
    private CurrentUser() {}

    public static Optional<UserPrincipal> optional() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p) return Optional.of(p);
        return Optional.empty();
    }

    public static UserPrincipal require() {
        return optional().orElseThrow(() -> ApiException.unauthorized("Log in to continue."));
    }
}
