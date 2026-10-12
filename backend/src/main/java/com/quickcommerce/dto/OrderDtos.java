package com.quickcommerce.dto;

import com.quickcommerce.entity.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class OrderDtos {
    private OrderDtos() {}

    public record CartItemRequest(@NotNull Long productId, @Min(1) @Max(20) int quantity) {}

    public record QuoteRequest(@NotNull Long storeId,
                               @NotEmpty @Size(max = 60) List<@Valid CartItemRequest> items,
                               String couponCode, Double latitude, Double longitude) {}

    public record QuoteLine(Long productId, String title, String imageUrl, String unitQuantity,
                            BigDecimal mrp, BigDecimal unitPrice, int requestedQuantity, int availableQuantity,
                            BigDecimal lineTotal, boolean inStock) {}

    public record CouponResult(String code, boolean applied, String message, BigDecimal discount) {}

    public record QuoteResponse(List<QuoteLine> lines, BigDecimal itemsMrp, BigDecimal subtotal, BigDecimal productSavings,
                                BigDecimal couponDiscount, BigDecimal deliveryFee, BigDecimal handlingFee,
                                BigDecimal total, BigDecimal amountForFreeDelivery, CouponResult coupon,
                                boolean allInStock, int etaMinutes) {}

    public record CheckoutRequest(@NotNull Long storeId,
                                  @NotEmpty @Size(max = 60) List<@Valid CartItemRequest> items,
                                  String couponCode,
                                  Long addressId,
                                  @Size(max = 500) String deliveryAddress,
                                  Double latitude, Double longitude,
                                  @NotNull PaymentMethod paymentMethod) {}

    public record CheckoutResponse(OrderResponse order, String paymentMode, String stripeClientSecret,
                                   Instant reservationExpiresAt, PaymentDtos.PaymentSession payment) {}

    public record OrderItemResponse(Long productId, String title, String imageUrl, String unitQuantity,
                                    BigDecimal unitPrice, int quantity, BigDecimal totalPrice) {}

    public record StatusEvent(String status, String note, Instant at) {}

    public record OrderResponse(Long id, String orderNumber, String status, String paymentMethod,
                                BigDecimal subtotal, BigDecimal discountAmount, BigDecimal deliveryFee,
                                BigDecimal handlingFee, BigDecimal totalAmount, String couponCode,
                                String deliveryAddress, Double deliveryLatitude, Double deliveryLongitude,
                                Long storeId, String storeName, Double storeLatitude, Double storeLongitude,
                                Double riderLatitude, Double riderLongitude, Instant riderLocationAt,
                                String deliveryAgentName, String deliveryAgentPhone,
                                String deliveryLandmark, String deliveryContactName, String deliveryContactPhone,
                                String paymentReference, String refundStatus,
                                String customerName, String customerPhone,
                                Instant createdAt, Instant paidAt, Instant deliveredAt, Instant reservationExpiresAt,
                                String cancelReason, List<OrderItemResponse> items, List<StatusEvent> timeline) {}

    public record MockPaymentRequest(boolean success) {}

    public record CancelRequest(@Size(max = 200) String reason) {}

    /** Payload pushed on /topic/orders/{id}/tracking. */
    public record TrackingUpdate(Long orderId, String status, Double riderLatitude, Double riderLongitude,
                                 Double distanceRemainingKm, Integer etaMinutes, String agentName, Instant at,
                                 Instant locationAt) {}

    /** Payload a delivery partner sends to /app/orders/{id}/location. */
    public record LocationUpdate(@NotNull Double latitude, @NotNull Double longitude) {}
}
