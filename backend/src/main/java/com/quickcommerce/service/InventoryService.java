package com.quickcommerce.service;

import com.quickcommerce.integration.AlertService;
import com.quickcommerce.config.AppProperties;
import com.quickcommerce.dto.AdminDtos.LowStockAlert;
import com.quickcommerce.dto.OrderDtos.CartItemRequest;
import com.quickcommerce.entity.Order;
import com.quickcommerce.entity.OrderItem;
import com.quickcommerce.entity.StoreInventory;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.exception.InsufficientStockException;
import com.quickcommerce.repository.StoreInventoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryService {

    private final StoreInventoryRepository inventoryRepository;
    private final RealtimePublisher publisher;
    private final AlertService alerts;
    private final AppProperties props;

    public record ReservedLine(StoreInventory inventory, int quantity) {}

    /**
     * Atomically reserves every line of a basket. Rows are locked in ascending product-id order so two
     * overlapping baskets can never deadlock; any shortfall rolls back the whole reservation.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<ReservedLine> reserve(Long storeId, List<CartItemRequest> items) {
        Map<Long, Integer> merged = new TreeMap<>();
        for (CartItemRequest i : items) merged.merge(i.productId(), i.quantity(), Integer::sum);

        List<ReservedLine> reserved = new ArrayList<>();
        for (Map.Entry<Long, Integer> e : merged.entrySet()) {
            StoreInventory inv = inventoryRepository.findAndLockInventory(storeId, e.getKey())
                    .orElseThrow(() -> ApiException.notFound("An item in your cart isn't sold at this store. Remove it and try again."));
            if (!inv.isAvailable() || !inv.getProduct().isActive()) {
                throw new InsufficientStockException(inv.getProduct().getTitle() + " is no longer available.");
            }
            if (inv.getStockQuantity() < e.getValue()) {
                throw new InsufficientStockException(inv.getStockQuantity() == 0
                        ? inv.getProduct().getTitle() + " just sold out."
                        : "Only " + inv.getStockQuantity() + " left of " + inv.getProduct().getTitle() + ". Reduce the quantity to continue.");
            }
            int before = inv.getStockQuantity();
            inv.setStockQuantity(before - e.getValue());
            inv.setSoldCount(inv.getSoldCount() + e.getValue());
            maybeAlertLowStock(storeId, inv, before);
            reserved.add(new ReservedLine(inv, e.getValue()));
        }
        return reserved;
    }

    /** Returns an order's units to the shelf (payment failed, reservation expired, or cancelled). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void release(Order order) {
        Long storeId = order.getDarkStore().getId();
        order.getItems().stream()
                .sorted(Comparator.comparing(oi -> oi.getProduct().getId()))
                .forEach((OrderItem oi) -> inventoryRepository.findAndLockInventory(storeId, oi.getProduct().getId())
                        .ifPresent(inv -> {
                            inv.setStockQuantity(inv.getStockQuantity() + oi.getQuantity());
                            inv.setSoldCount(Math.max(0, inv.getSoldCount() - oi.getQuantity()));
                        }));
        log.info("Released stock for order {}", order.getOrderNumber());
    }

    /** Tries to re-take stock for an order whose hold lapsed but whose payment still arrived. */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean tryReReserve(Order order) {
        List<CartItemRequest> items = order.getItems().stream()
                .map(oi -> new CartItemRequest(oi.getProduct().getId(), oi.getQuantity())).toList();
        try {
            reserve(order.getDarkStore().getId(), items);
            return true;
        } catch (ApiException ex) {
            return false;
        }
    }

    void maybeAlertLowStock(Long storeId, StoreInventory inv, int before) {
        int threshold = props.checkout().lowStockThreshold();
        if (before >= threshold && inv.getStockQuantity() < threshold) {
            publisher.publishAfterCommit(RealtimePublisher.storeAlertsTopic(storeId),
                    new LowStockAlert(storeId, inv.getProduct().getId(), inv.getProduct().getTitle(), inv.getStockQuantity()));
            alerts.notify(AlertService.Kind.STOCK, (inv.getStockQuantity() == 0 ? ":no_entry: OUT OF STOCK: *" : ":warning: Low stock: *")
                    + inv.getProduct().getTitle() + "* — " + inv.getStockQuantity() + " left at " + inv.getDarkStore().getName());
        }
    }
}
