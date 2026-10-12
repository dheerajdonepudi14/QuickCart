package com.quickcommerce.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.Map;

public final class CommonDtos {
    private CommonDtos() {}

    public record ApiError(Instant timestamp, int status, String error, String message, String path,
                           Map<String, String> fieldErrors) {}

    public record MessageResponse(String message) {}

    public record NewsletterRequest(@NotBlank @Email String email) {}
}
