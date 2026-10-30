package com.quickcommerce.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class StatsDtos {
    private StatsDtos() {}

    /** Public, privacy-safe platform numbers shown on the storefront and the admin header. */
    public record PlatformStats(long registeredUsers, long activeSessions, long loginsToday, long newUsersToday,
                                long products, long categories, long darkStores,
                                long unitsSold, long unitsInStock, long outOfStockSkus,
                                long ordersPlaced, long ordersDelivered, Instant generatedAt) {}

    public record AdminUserRow(Long id, String fullName, String email, String phoneNumber, String role, String provider,
                               Instant createdAt, Instant lastLoginAt, int loginCount, boolean loggedIn,
                               long orders, BigDecimal totalSpent) {}

    public record ProductImageRow(Long id, String title, String brand, String categoryName, String categorySlug,
                                  String unitQuantity, String imageUrl, boolean hasRealImage,
                                  long unitsSold, long unitsInStock, String imageAlt, String imageUrlB,
                                  Integer imageWidth, Integer imageHeight,
                                  long impressionsA, long addToCartsA, long impressionsB, long addToCartsB) {}

    /** variant = A (main photo, default) or B (A/B test). alt updates the alt text only. */
    public record ImageUpdateRequest(String imageUrl, String variant, String alt) {}

    public record PageOf<T>(List<T> content, int page, int size, long totalElements, int totalPages, boolean last) {}
}
