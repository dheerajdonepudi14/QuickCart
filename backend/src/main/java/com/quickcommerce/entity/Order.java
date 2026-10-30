package com.quickcommerce.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
@Getter @Setter @NoArgsConstructor
public class Order {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_number", nullable = false, unique = true, length = 50)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "dark_store_id")
    private DarkStore darkStore;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delivery_agent_id")
    private User deliveryAgent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OrderStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 20)
    private PaymentMethod paymentMethod;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "discount_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "delivery_fee", nullable = false, precision = 10, scale = 2)
    private BigDecimal deliveryFee = BigDecimal.ZERO;

    @Column(name = "handling_fee", nullable = false, precision = 10, scale = 2)
    private BigDecimal handlingFee = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "coupon_code", length = 30)
    private String couponCode;

    @Column(name = "delivery_address", nullable = false, columnDefinition = "TEXT")
    private String deliveryAddress;

    @Column(name = "delivery_latitude")
    private Double deliveryLatitude;

    @Column(name = "delivery_longitude")
    private Double deliveryLongitude;

    @Column(name = "rider_latitude")
    private Double riderLatitude;

    @Column(name = "rider_longitude")
    private Double riderLongitude;

    @Column(name = "stripe_payment_intent_id", length = 100)
    private String stripePaymentIntentId;

    /** Gateway order reference: Razorpay order_xxx, PhonePe merchantOrderId or the UPI transaction ref. */
    @Column(name = "payment_reference", length = 120)
    private String paymentReference;

    /** null, PENDING, REFUNDED or FAILED. */
    @Column(name = "refund_status", length = 20)
    private String refundStatus;

    @Column(name = "delivery_landmark", length = 200)
    private String deliveryLandmark;

    @Column(name = "delivery_contact_name", length = 100)
    private String deliveryContactName;

    @Column(name = "delivery_contact_phone", length = 20)
    private String deliveryContactPhone;

    /** Time of the last rider GPS fix — used to flag stale locations to the customer. */
    @Column(name = "rider_location_at")
    private Instant riderLocationAt;

    @Column(name = "reservation_expires_at")
    private Instant reservationExpiresAt;

    @Column(name = "cancel_reason", length = 200)
    private String cancelReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<OrderStatusHistory> history = new ArrayList<>();

    @PreUpdate
    void touch() { this.updatedAt = Instant.now(); }

    public void addItem(OrderItem item) {
        item.setOrder(this);
        items.add(item);
    }

    public void recordStatus(OrderStatus newStatus, String note) {
        this.status = newStatus;
        OrderStatusHistory h = new OrderStatusHistory();
        h.setOrder(this);
        h.setStatus(newStatus);
        h.setNote(note);
        history.add(h);
    }
}
