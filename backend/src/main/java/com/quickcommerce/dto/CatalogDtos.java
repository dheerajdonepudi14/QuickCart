package com.quickcommerce.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public final class CatalogDtos {
    private CatalogDtos() {}

    public record CategoryResponse(Long id, String name, String slug, String imageUrl,
                                   String department, String themeColor) {}

    public record ProductCardResponse(Long id, String title, String brand, String unitQuantity,
                                      BigDecimal mrp, BigDecimal salePrice, int discountPercent,
                                      String imageUrl, double rating, String categorySlug, String categoryName,
                                      int stockQuantity, String stockStatus, List<String> badges,
                                      int soldCount, String imageAlt, String imageUrlB) {}

    public record ProductDetailResponse(ProductCardResponse product, String description,
                                        Map<String, Object> attributes, List<ProductCardResponse> frequentlyBoughtTogether,
                                        List<ProductCardResponse> similar) {}

    public record SuggestionResponse(Long id, String title, String brand, String imageUrl,
                                     String categoryName, BigDecimal salePrice) {}

    public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages, boolean last) {}
}
