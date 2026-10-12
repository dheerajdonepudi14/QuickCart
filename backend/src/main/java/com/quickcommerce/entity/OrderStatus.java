package com.quickcommerce.entity;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Order lifecycle state machine.
 * CREATED (stock reserved, awaiting payment) -> ORDER_PLACED -> PACKING_IN_PROGRESS -> OUT_FOR_DELIVERY -> DELIVERED
 * Terminal side exits: PAYMENT_FAILED, EXPIRED, CANCELLED.
 */
public enum OrderStatus {
    CREATED, ORDER_PLACED, PACKING_IN_PROGRESS, OUT_FOR_DELIVERY, DELIVERED,
    PAYMENT_FAILED, EXPIRED, CANCELLED;

    private static final Map<OrderStatus, Set<OrderStatus>> TRANSITIONS = Map.of(
            CREATED, EnumSet.of(ORDER_PLACED, PAYMENT_FAILED, EXPIRED, CANCELLED),
            ORDER_PLACED, EnumSet.of(PACKING_IN_PROGRESS, CANCELLED),
            PACKING_IN_PROGRESS, EnumSet.of(OUT_FOR_DELIVERY, CANCELLED),
            OUT_FOR_DELIVERY, EnumSet.of(DELIVERED),
            DELIVERED, EnumSet.noneOf(OrderStatus.class),
            PAYMENT_FAILED, EnumSet.noneOf(OrderStatus.class),
            EXPIRED, EnumSet.noneOf(OrderStatus.class),
            CANCELLED, EnumSet.noneOf(OrderStatus.class)
    );

    public boolean canTransitionTo(OrderStatus next) {
        return TRANSITIONS.getOrDefault(this, Set.of()).contains(next);
    }

    /** Statuses in which reserved stock must be returned to the shelf. */
    public boolean releasesStock() {
        return this == PAYMENT_FAILED || this == EXPIRED || this == CANCELLED;
    }

    public boolean isActive() {
        return this == ORDER_PLACED || this == PACKING_IN_PROGRESS || this == OUT_FOR_DELIVERY;
    }
}
