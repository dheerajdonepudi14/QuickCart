package com.quickcommerce.service;

import com.quickcommerce.config.AppProperties;
import com.quickcommerce.dto.AdminDtos.*;
import com.quickcommerce.dto.CatalogDtos.PageResponse;
import com.quickcommerce.dto.OrderDtos.OrderResponse;
import com.quickcommerce.entity.*;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.payment.PaymentFlowService;
import com.quickcommerce.repository.OrderRepository;
import com.quickcommerce.repository.StoreInventoryRepository;
import com.quickcommerce.repository.UserRepository;
import com.quickcommerce.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final StoreInventoryRepository inventoryRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final InventoryService inventoryService;
    private final RealtimePublisher publisher;
    private final OrderService orderService;
    private final PaymentFlowService paymentFlow;
    private final AppProperties props;

    public void assertStoreAccess(UserPrincipal admin, Long storeId) {
        if (!admin.canManageStore(storeId)) throw ApiException.forbidden("You can only manage your own store.");
    }

    // ---------------- inventory

    @Transactional(readOnly = true)
    public PageResponse<InventoryRow> inventory(UserPrincipal admin, Long storeId, String q, boolean lowStockOnly, int page, int size) {
        assertStoreAccess(admin, storeId);
        int threshold = props.checkout().lowStockThreshold();
        Page<StoreInventory> result = inventoryRepository.adminSearch(storeId, CatalogService.likePattern(q), lowStockOnly,
                threshold, PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                        Sort.by(Sort.Direction.ASC, "stockQuantity").and(Sort.by("id"))));
        return new PageResponse<>(result.getContent().stream().map(this::toRow).toList(), result.getNumber(),
                result.getSize(), result.getTotalElements(), result.getTotalPages(), result.isLast());
    }

    @Transactional
    public InventoryRow updateInventory(UserPrincipal admin, Long inventoryId, InventoryUpdateRequest req) {
        StoreInventory inv = inventoryRepository.findById(inventoryId)
                .orElseThrow(() -> ApiException.notFound("Inventory row not found."));
        Long storeId = inv.getDarkStore().getId();
        assertStoreAccess(admin, storeId);
        // Re-read under lock so admin edits never race with a checkout decrement.
        inv = inventoryRepository.findAndLockInventory(storeId, inv.getProduct().getId()).orElseThrow();

        int before = inv.getStockQuantity();
        if (req.stockQuantity() != null) inv.setStockQuantity(req.stockQuantity());
        if (req.salePrice() != null) {
            if (req.salePrice().compareTo(inv.getProduct().getBasePrice()) > 0) {
                throw ApiException.badRequest("Sale price can't be higher than MRP (₹" + inv.getProduct().getBasePrice() + ").");
            }
            inv.setSalePrice(req.salePrice().setScale(2, RoundingMode.HALF_UP));
        }
        if (req.available() != null) inv.setAvailable(req.available());
        if (req.productActive() != null) {
            if (admin.storeId() != null) throw ApiException.forbidden("Only the central admin can switch products off for every store.");
            inv.getProduct().setActive(req.productActive());
        }
        inventoryService.maybeAlertLowStock(storeId, inv, before);
        return toRow(inv);
    }

    // ---------------- orders

    private static final Set<OrderStatus> LIVE = EnumSet.of(OrderStatus.CREATED, OrderStatus.ORDER_PLACED,
            OrderStatus.PACKING_IN_PROGRESS, OrderStatus.OUT_FOR_DELIVERY);

    @Transactional(readOnly = true)
    public List<OrderResponse> controlTower(UserPrincipal admin, Long storeId, String scope) {
        assertStoreAccess(admin, storeId);
        Set<OrderStatus> statuses = "history".equals(scope)
                ? EnumSet.of(OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED, OrderStatus.EXPIRED)
                : LIVE;
        return orderRepository.findForControlTower(storeId, statuses, PageRequest.of(0, 100)).stream()
                .map(o -> orderService.toResponse(o, true)).toList();
    }

    @Transactional(readOnly = true)
    public List<AgentResponse> agents(UserPrincipal admin, Long storeId) {
        assertStoreAccess(admin, storeId);
        Set<Long> busy = orderRepository.findForControlTower(storeId, EnumSet.of(OrderStatus.OUT_FOR_DELIVERY), PageRequest.of(0, 500))
                .stream().filter(o -> o.getDeliveryAgent() != null).map(o -> o.getDeliveryAgent().getId()).collect(Collectors.toSet());
        return userRepository.findByRoleAndStoreId(Role.ROLE_DELIVERY_PARTNER, storeId).stream()
                .map(u -> new AgentResponse(u.getId(), u.getFullName(), u.getPhoneNumber(), busy.contains(u.getId()))).toList();
    }

    @Transactional
    public OrderResponse act(UserPrincipal admin, Long orderId, String action, Long agentId, String reason) {
        Long storeId = orderRepository.findById(orderId).map(o -> o.getDarkStore().getId())
                .orElseThrow(() -> ApiException.notFound("Order not found."));
        assertStoreAccess(admin, storeId);
        switch (action) {
            case "pack" -> orderService.markPacking(orderId);
            case "assign" -> {
                if (agentId == null) throw ApiException.badRequest("Pick a delivery partner.");
                if (userRepository.findById(agentId).map(u -> u.getStore() == null || !u.getStore().getId().equals(storeId)).orElse(true)) {
                    throw ApiException.badRequest("That rider doesn't work at this store.");
                }
                orderService.assignAgentAndDispatch(orderId, agentId);
            }
            case "deliver" -> orderService.markDelivered(orderId);
            case "cancel" -> orderService.cancelByStore(orderId, reason);
            case "verify-payment" -> paymentFlow.verifyUpiByStore(orderId, true, reason);
            case "reject-payment" -> paymentFlow.verifyUpiByStore(orderId, false, reason);
            default -> throw ApiException.badRequest("Unknown action: " + action);
        }
        return orderService.toResponse(orderService.load(orderId), true);
    }

    // ---------------- analytics

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(UserPrincipal admin, Long storeId, String range) {
        assertStoreAccess(admin, storeId);
        String bucket;
        Duration window;
        switch (range == null ? "daily" : range) {
            case "weekly" -> { bucket = "week"; window = Duration.ofDays(7 * 12); }
            case "monthly" -> { bucket = "month"; window = Duration.ofDays(365); }
            default -> { bucket = "day"; window = Duration.ofDays(14); }
        }
        Instant since = Instant.now().minus(window);

        List<RevenuePoint> series = orderRepository.revenueSeries(storeId, bucket, since).stream()
                .map(r -> new RevenuePoint((String) r[0], toBig(r[1]), ((Number) r[2]).longValue())).toList();
        List<TopSku> top = orderRepository.topSellingSkus(storeId, since, 8).stream()
                .map(r -> new TopSku(((Number) r[0]).longValue(), (String) r[1], (String) r[2],
                        ((Number) r[3]).longValue(), toBig(r[4]))).toList();
        Object[] k = orderRepository.kpis(storeId, since).get(0);
        int threshold = props.checkout().lowStockThreshold();

        return new DashboardResponse(toBig(k[0]), ((Number) k[1]).longValue(), toBig(k[2]).setScale(2, RoundingMode.HALF_UP),
                orderRepository.countByStoreAndStatuses(storeId, EnumSet.of(OrderStatus.ORDER_PLACED,
                        OrderStatus.PACKING_IN_PROGRESS, OrderStatus.OUT_FOR_DELIVERY)),
                inventoryRepository.countLowStock(storeId, threshold), inventoryRepository.countOutOfStock(storeId),
                series, top);
    }

    private InventoryRow toRow(StoreInventory i) {
        Product p = i.getProduct();
        return new InventoryRow(i.getId(), p.getId(), p.getTitle(), p.getBrand(), p.getImageUrl(), p.getCategory().getName(),
                p.getUnitQuantity(), p.getBasePrice(), i.getSalePrice(), i.getStockQuantity(), i.isAvailable(), p.isActive(),
                i.getStockQuantity() < props.checkout().lowStockThreshold(), i.getSoldCount());
    }

    private static BigDecimal toBig(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal b) return b;
        return new BigDecimal(o.toString());
    }
}
