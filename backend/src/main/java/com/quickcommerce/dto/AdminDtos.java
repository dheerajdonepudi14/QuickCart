package com.quickcommerce.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;

import java.math.BigDecimal;
import java.util.List;

public final class AdminDtos {
    private AdminDtos() {}

    public record InventoryRow(Long inventoryId, Long productId, String title, String brand, String imageUrl,
                               String categoryName, String unitQuantity, BigDecimal mrp, BigDecimal salePrice,
                               int stockQuantity, boolean available, boolean productActive, boolean lowStock,
                               int soldCount) {}

    public record InventoryUpdateRequest(@Min(0) Integer stockQuantity,
                                         @DecimalMin("1.00") BigDecimal salePrice,
                                         Boolean available,
                                         Boolean productActive) {}

    public record LowStockAlert(Long storeId, Long productId, String title, int stockQuantity) {}

    public record AssignAgentRequest(Long agentId) {}

    public record AgentResponse(Long id, String name, String phone, boolean busy) {}

    public record RevenuePoint(String period, BigDecimal revenue, long orders) {}

    public record TopSku(Long productId, String title, String imageUrl, long units, BigDecimal revenue) {}

    public record DashboardResponse(BigDecimal revenue, long orders, BigDecimal averageOrderValue,
                                    long activeOrders, long lowStockCount, long outOfStockCount,
                                    List<RevenuePoint> series, List<TopSku> topSkus) {}
}
