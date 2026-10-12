package com.quickcommerce.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class AuthDtos {
    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank @Size(min = 2, max = 100) String fullName,
            @NotBlank @Email @Size(max = 150) String email,
            @Pattern(regexp = "^$|^[+]?[0-9]{10,14}$", message = "must be a valid phone number") String phoneNumber,
            @NotBlank @Size(min = 8, max = 72) String password) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record UserResponse(Long id, String fullName, String email, String phoneNumber,
                               String role, String provider, Long storeId, String storeName) {}

    /** Tokens travel in HttpOnly cookies; the body only carries the profile and expiry. */
    public record AuthResponse(UserResponse user, long accessTokenExpiresInSeconds) {}

    public record ProvidersResponse(List<String> oauthProviders) {}
}
