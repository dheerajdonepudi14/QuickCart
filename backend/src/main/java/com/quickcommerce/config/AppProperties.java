package com.quickcommerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;
import java.util.List;

@ConfigurationProperties(prefix = "app")
public record AppProperties(String frontendUrl, Cors cors, Jwt jwt, RateLimit rateLimit, Checkout checkout,
                            Stripe stripe, Simulation simulation, Seed seed) {

    public record Cors(List<String> allowedOrigins) {}

    public record Jwt(String secret, long accessTokenTtlMinutes, long refreshTokenTtlDays, boolean cookieSecure) {}

    public record RateLimit(int requestsPerMinute, int authRequestsPerMinute) {}

    public record Checkout(int reservationMinutes, BigDecimal freeDeliveryThreshold, BigDecimal baseDeliveryFee,
                           double farDistanceKm, BigDecimal farDistanceSurcharge, BigDecimal handlingFee,
                           int lowStockThreshold, double serviceableRadiusKm) {}

    public record Stripe(String secretKey, String webhookSecret, String currency) {
        public boolean enabled() { return secretKey != null && !secretKey.isBlank(); }
    }

    public record Simulation(boolean autoProgress, int packingSeconds, long trackingIntervalMs,
                             double riderSpeedMetersPerTick) {}

    public record Seed(String adminEmail, String adminPassword) {}
}
