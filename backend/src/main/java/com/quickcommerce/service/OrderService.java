package com.quickcommerce.service;

import com.quickcommerce.config.AppProperties;
import com.quickcommerce.dto.OrderDtos.*;
import com.quickcommerce.entity.*;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.repository.*;
import com.quickcommerce.security.UserPrincipal;
import com.quickcommerce.dto.PaymentDtos.PaymentSession;
import com.quickcommerce.integration.AlertService;
import com.quickcommerce.payment.PaymentService;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final CouponRepository couponRepository;
    private final StoreInventoryRepository inventoryRepository;
    private final StoreService storeService;
    private final InventoryService inventoryService;
    private final PricingService pricingService;
    private final PaymentService payments;
    private final RealtimePublisher publisher;
    private final AlertService alerts;
    private final MeterRegistry meters;
    private final AppProperties props;

    // ------------------------------------------------------------------ quote (no locks)

    @Transactional(readOnly = true)
    public QuoteResponse quote(QuoteRequest req) {
        DarkStore store = storeService.require(req.storeId());
        Map<Long, Integer> wanted = new LinkedHashMap<>();
        req.items().forEach(i -> wanted.merge(i.productId(), i.quantity(), Integer::sum));

        Map<Long, StoreInventory> byProduct = new HashMap<>();
        inventoryRepository.findForStoreAndProducts(store.getId(), wanted.keySet())
                .forEach(i -> byProduct.put(i.getProduct().getId(), i));

        List<QuoteLine> lines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO, mrpTotal = BigDecimal.ZERO;
        boolean allInStock = true;
        for (Map.Entry<Long, Integer> e : wanted.entrySet()) {
            StoreInventory inv = byProduct.get(e.getKey());
            if (inv == null) { allInStock = false; continue; }
            Product p = inv.getProduct();
            int available = inv.isAvailable() && p.isActive() ? inv.getStockQuantity() : 0;
            boolean ok = available >= e.getValue();
            allInStock &= ok;
            int billable = Math.min(e.getValue(), available);
            BigDecimal line = inv.getSalePrice().multiply(BigDecimal.valueOf(billable));
            subtotal = subtotal.add(line);
            mrpTotal = mrpTotal.add(p.getBasePrice().multiply(BigDecimal.valueOf(billable)));
            lines.add(new QuoteLine(p.getId(), p.getTitle(), p.getImageUrl(), p.getUnitQuantity(), p.getBasePrice(),
                    inv.getSalePrice(), e.getValue(), available, line, ok));
        }
        double km = distanceKm(store, req.latitude(), req.longitude());
        PricingService.Breakdown b = pricingService.price(subtotal, req.couponCode(), km);
        return new QuoteResponse(lines, mrpTotal, b.subtotal(), mrpTotal.subtract(subtotal), b.couponDiscount(),
                b.deliveryFee(), b.handlingFee(), b.total(), b.amountForFreeDelivery(), b.coupon(), allInStock,
                GeoUtils.etaMinutes(km));
    }

    // ------------------------------------------------------------------ checkout (atomic reservation)

    @Transactional
    public CheckoutResponse checkout(UserPrincipal principal, CheckoutRequest req) {
        User user = userRepository.getReferenceById(principal.id());
        DarkStore store = storeService.require(req.storeId());

        String addressText = req.deliveryAddress();
        Double lat = req.latitude(), lng = req.longitude();
        String landmark = null, contactName = user.getFullName(), contactPhone = user.getPhoneNumber();
        if (req.addressId() != null) {
            Address a = addressRepository.findByIdAndUserId(req.addressId(), principal.id())
                    .orElseThrow(() -> ApiException.notFound("Saved address not found."));
            addressText = a.toSingleLine();
            landmark = a.getLandmark();
            if (a.getContactName() != null && !a.getContactName().isBlank()) contactName = a.getContactName();
            if (a.getContactPhone() != null && !a.getContactPhone().isBlank()) contactPhone = a.getContactPhone();
            if (a.getLatitude() != null) { lat = a.getLatitude(); lng = a.getLongitude(); }
        }
        if (addressText == null || addressText.isBlank()) throw ApiException.badRequest("Add a delivery address to continue.");
        if (lat != null && lng != null) {
            double km = GeoUtils.haversineKm(store.getLatitude(), store.getLongitude(), lat, lng);
            if (km > props.checkout().serviceableRadiusKm()) {
                throw ApiException.badRequest(String.format(Locale.ROOT,
                        "This address is %.0f km from %s, outside its delivery zone. Switch to the store nearest the address.",
                        km, store.getName()));
            }
        } else {
            // Without coordinates we drop the pin ~1-2 km from the store so live tracking still has a route.
            double angle = ThreadLocalRandom.current().nextDouble(0, 2 * Math.PI);
            double dist = ThreadLocalRandom.current().nextDouble(0.009, 0.016);
            lat = store.getLatitude() + dist * Math.cos(angle);
            lng = store.getLongitude() + dist * Math.sin(angle);
        }
        payments.ensureAvailable(req.paymentMethod());

        // 1. Lock rows and deduct stock (all-or-nothing)
        List<InventoryService.ReservedLine> reserved = inventoryService.reserve(store.getId(), req.items());

        // 2. Build order
        Order order = new Order();
        order.setOrderNumber(nextOrderNumber());
        order.setUser(user);
        order.setDarkStore(store);
        order.setPaymentMethod(req.paymentMethod());
        order.setDeliveryAddress(addressText.trim());
        order.setDeliveryLatitude(lat);
        order.setDeliveryLongitude(lng);
        order.setDeliveryLandmark(landmark);
        order.setDeliveryContactName(contactName);
        order.setDeliveryContactPhone(contactPhone);

        BigDecimal subtotal = BigDecimal.ZERO;
        for (InventoryService.ReservedLine r : reserved) {
            Product p = r.inventory().getProduct();
            BigDecimal lineTotal = r.inventory().getSalePrice().multiply(BigDecimal.valueOf(r.quantity()));
            OrderItem oi = new OrderItem();
            oi.setProduct(p);
            oi.setProductTitle(p.getTitle());
            oi.setImageUrl(p.getImageUrl());
            oi.setUnitQuantity(p.getUnitQuantity());
            oi.setUnitPrice(r.inventory().getSalePrice());
            oi.setQuantity(r.quantity());
            oi.setTotalPrice(lineTotal);
            order.addItem(oi);
            subtotal = subtotal.add(lineTotal);
        }

        PricingService.Breakdown b = pricingService.price(subtotal, req.couponCode(), distanceKm(store, lat, lng));
        if (req.couponCode() != null && !req.couponCode().isBlank() && (b.coupon() == null || !b.coupon().applied())) {
            throw ApiException.badRequest(b.coupon() != null ? b.coupon().message() : "This code isn't valid.");
        }
        order.setSubtotal(b.subtotal());
        order.setDiscountAmount(b.couponDiscount());
        order.setDeliveryFee(b.deliveryFee());
        order.setHandlingFee(b.handlingFee());
        order.setTotalAmount(b.total());
        order.setCouponCode(b.coupon() != null && b.coupon().applied() ? b.coupon().code() : null);

        // 3. Payment path
        if (req.paymentMethod() == PaymentMethod.CASH_ON_DELIVERY) {
            order.recordStatus(OrderStatus.ORDER_PLACED, "Cash on delivery");
            consumeCoupon(order);
        } else {
            order.recordStatus(OrderStatus.CREATED, "Stock held for " + props.checkout().reservationMinutes() + " minutes");
            order.setReservationExpiresAt(Instant.now().plus(Duration.ofMinutes(props.checkout().reservationMinutes())));
        }
        orderRepository.saveAndFlush(order);

        // Gateway order / intent is created inside this transaction: if the gateway fails, the stock hold rolls back.
        PaymentSession session = payments.startSession(order);
        if (order.getStatus() == OrderStatus.ORDER_PLACED) {
            publishStatus(order);
            announceNewOrder(order);
        }
        meters.counter("quickcart.orders.created", "payment", req.paymentMethod().name()).increment();
        log.info("Order {} created ({}), total {}", order.getOrderNumber(), req.paymentMethod(), order.getTotalAmount());
        return new CheckoutResponse(toResponse(order), session.mode(), session.stripeClientSecret(),
                order.getReservationExpiresAt(), session);
    }

    /** Re-builds the checkout response for an idempotent replay of POST /checkout. */
    @Transactional
    public CheckoutResponse replayCheckout(UserPrincipal principal, Long orderId) {
        Order order = loadForPayment(orderId, principal);
        PaymentSession session = order.getStatus() == OrderStatus.CREATED
                ? payments.startSession(order)
                : new PaymentSession("NONE", payments.gatewayFor(order.getPaymentMethod()), null, null, null, null, null);
        return new CheckoutResponse(toResponse(order), session.mode(), session.stripeClientSecret(),
                order.getReservationExpiresAt(), session);
    }

    // ------------------------------------------------------------------ payment outcomes

    @Transactional
    public OrderResponse confirmPayment(Long orderId, String source) {
        Order order = load(orderId);
        if (order.getStatus() == OrderStatus.ORDER_PLACED || order.getStatus().isActive()
                || order.getStatus() == OrderStatus.DELIVERED) {
            return toResponse(order); // idempotent: webhook + client verify may both arrive
        }
        if (order.getStatus() == OrderStatus.CANCELLED) {
            // Money arrived for an order that was already cancelled: give it back (once).
            if (order.getRefundStatus() == null) {
                order.setPaidAt(Instant.now());
                payments.refund(order, "Payment received after cancellation");
            }
            return toResponse(order);
        }
        if (order.getStatus() == OrderStatus.EXPIRED || order.getStatus() == OrderStatus.PAYMENT_FAILED) {
            // Money arrived after the hold lapsed: try to take the stock again, otherwise refund.
            if (!inventoryService.tryReReserve(order)) {
                order.setPaidAt(Instant.now());
                payments.refund(order, "Items sold out before payment completed");
                order.recordStatus(OrderStatus.CANCELLED, "Items sold out before payment completed; refund issued");
                order.setCancelReason("Items sold out before payment completed. A full refund has been issued.");
                publishStatus(order);
                return toResponse(order);
            }
            order.setStatus(OrderStatus.CREATED);
        }
        transition(order, OrderStatus.ORDER_PLACED, "Payment received via " + source);
        order.setPaidAt(Instant.now());
        order.setReservationExpiresAt(null);
        consumeCoupon(order);
        meters.counter("quickcart.orders.placed", "payment", order.getPaymentMethod().name()).increment();
        announceNewOrder(order);
        return toResponse(order);
    }

    @Transactional
    public OrderResponse failPayment(Long orderId, String reason) {
        Order order = load(orderId);
        if (order.getStatus() != OrderStatus.CREATED) return toResponse(order);
        inventoryService.release(order);
        transition(order, OrderStatus.PAYMENT_FAILED, reason);
        return toResponse(order);
    }

    @Transactional
    public void expireReservation(Long orderId) {
        Order order = load(orderId);
        if (order.getStatus() != OrderStatus.CREATED) return;
        if (order.getReservationExpiresAt() == null || order.getReservationExpiresAt().isAfter(Instant.now())) return;
        // Last check with the gateway so a payment that completed a moment ago isn't lost.
        PaymentService.Reconciliation r = payments.reconcile(order);
        String gateway = payments.gatewayFor(order.getPaymentMethod());
        if (r.state() == PaymentService.PaidState.PAID) {
            payments.markSucceeded(order, gateway, r.paymentId(), null);
            confirmPayment(orderId, PaymentService.label(order.getPaymentMethod()) + " (reconciled)");
            return;
        }
        boolean graceOver = order.getReservationExpiresAt().isBefore(Instant.now().minus(Duration.ofMinutes(15)));
        if (r.state() == PaymentService.PaidState.PENDING && !graceOver) return; // gateway still processing
        inventoryService.release(order);
        payments.markFailed(order, gateway, "Payment not completed in time");
        transition(order, OrderStatus.EXPIRED, "Payment not completed in time; stock released");
    }

    @Transactional
    public Order loadForPayment(Long orderId, UserPrincipal principal) {
        Order order = load(orderId);
        if (!order.getUser().getId().equals(principal.id())) throw ApiException.forbidden("This isn't your order.");
        return order;
    }

    // ------------------------------------------------------------------ lifecycle

    @Transactional
    public OrderResponse cancelByCustomer(UserPrincipal principal, Long orderId, String reason) {
        Order order = load(orderId);
        if (!order.getUser().getId().equals(principal.id())) throw ApiException.forbidden("This isn't your order.");
        if (order.getStatus() != OrderStatus.CREATED && order.getStatus() != OrderStatus.ORDER_PLACED) {
            throw ApiException.conflict("Your order is already being packed, so it can't be cancelled now.");
        }
        return cancel(order, reason == null || reason.isBlank() ? "Cancelled by customer" : reason);
    }

    @Transactional
    public OrderResponse cancelByStore(Long orderId, String reason) {
        return cancel(load(orderId), reason == null || reason.isBlank() ? "Cancelled by store" : reason);
    }

    private OrderResponse cancel(Order order, String reason) {
        if (!order.getStatus().canTransitionTo(OrderStatus.CANCELLED)) {
            throw ApiException.conflict("Orders that are out for delivery can't be cancelled.");
        }
        inventoryService.release(order);
        if (order.getPaidAt() != null) payments.refund(order, reason);
        order.setCancelReason(reason);
        transition(order, OrderStatus.CANCELLED, reason);
        alerts.notify(AlertService.Kind.ORDER, ":x: Order *" + order.getOrderNumber() + "* cancelled — " + reason
                + (order.getRefundStatus() != null ? " (refund " + order.getRefundStatus().toLowerCase() + ")" : ""));
        return toResponse(order);
    }

    @Transactional
    public OrderResponse markPacking(Long orderId) {
        Order order = load(orderId);
        transition(order, OrderStatus.PACKING_IN_PROGRESS, "Picker started packing your items");
        return toResponse(order);
    }

    @Transactional
    public OrderResponse assignAgentAndDispatch(Long orderId, Long agentId) {
        Order order = load(orderId);
        if (order.getStatus() == OrderStatus.ORDER_PLACED) {
            transition(order, OrderStatus.PACKING_IN_PROGRESS, "Packed at store");
        }
        User agent = userRepository.findById(agentId)
                .filter(u -> u.getRole() == Role.ROLE_DELIVERY_PARTNER)
                .orElseThrow(() -> ApiException.notFound("Delivery partner not found."));
        order.setDeliveryAgent(agent);
        order.setRiderLatitude(order.getDarkStore().getLatitude());
        order.setRiderLongitude(order.getDarkStore().getLongitude());
        transition(order, OrderStatus.OUT_FOR_DELIVERY, agent.getFullName() + " picked up your order");
        return toResponse(order);
    }

    @Transactional
    public TrackingUpdate updateRiderLocation(Long orderId, double lat, double lng) {
        return updateRiderLocation(orderId, lat, lng, null);
    }

    /** routeRemainingKm (optional) is the road distance left on the planned route; improves the ETA. */
    @Transactional
    public TrackingUpdate updateRiderLocation(Long orderId, double lat, double lng, Double routeRemainingKm) {
        Order order = load(orderId);
        if (order.getStatus() != OrderStatus.OUT_FOR_DELIVERY) {
            throw ApiException.conflict("Location updates are only accepted while the order is out for delivery.");
        }
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw ApiException.badRequest("Invalid coordinates.");
        order.setRiderLatitude(lat);
        order.setRiderLongitude(lng);
        order.setRiderLocationAt(Instant.now());
        double remaining = GeoUtils.haversineKm(lat, lng, order.getDeliveryLatitude(), order.getDeliveryLongitude());
        if (remaining < 0.05) {
            return completeDelivery(order);
        }
        double roadKm = routeRemainingKm != null ? routeRemainingKm : remaining * 1.3;
        TrackingUpdate update = tracking(order, remaining, roadKm);
        publisher.publishAfterCommit(RealtimePublisher.trackingTopic(orderId), update);
        return update;
    }

    @Transactional
    public OrderResponse markDelivered(Long orderId) {
        Order order = load(orderId);
        completeDelivery(order);
        return toResponse(order, true);
    }

    private TrackingUpdate completeDelivery(Order order) {
        order.setDeliveredAt(Instant.now());
        transition(order, OrderStatus.DELIVERED, "Delivered. Enjoy!");
        TrackingUpdate last = tracking(order, 0, 0);
        // Privacy: stop exposing the rider's position once the order is complete.
        order.setRiderLatitude(null);
        order.setRiderLongitude(null);
        publisher.publishAfterCommit(RealtimePublisher.trackingTopic(order.getId()), last);
        return last;
    }

    /** Latest known tracking snapshot — the polling fallback when the WebSocket is unavailable. */
    @Transactional(readOnly = true)
    public TrackingUpdate latestTracking(UserPrincipal principal, Long orderId) {
        getForUser(principal, orderId); // access check
        Order o = load(orderId);
        if (o.getRiderLatitude() == null || o.getDeliveryLatitude() == null) return tracking(o, 0, 0);
        double remaining = GeoUtils.haversineKm(o.getRiderLatitude(), o.getRiderLongitude(),
                o.getDeliveryLatitude(), o.getDeliveryLongitude());
        return tracking(o, remaining, remaining * 1.3);
    }

    /** Active deliveries assigned to a rider (rider app). */
    @Transactional(readOnly = true)
    public List<OrderResponse> riderOrders(UserPrincipal rider) {
        return orderRepository.findForAgent(rider.id(), List.of(OrderStatus.PACKING_IN_PROGRESS, OrderStatus.OUT_FOR_DELIVERY))
                .stream().map(o -> toResponse(o, true)).toList();
    }

    @Transactional
    public OrderResponse riderMarkDelivered(UserPrincipal rider, Long orderId) {
        Order order = load(orderId);
        if (order.getDeliveryAgent() == null || !order.getDeliveryAgent().getId().equals(rider.id())) {
            throw ApiException.forbidden("This delivery isn't assigned to you.");
        }
        if (order.getStatus() != OrderStatus.OUT_FOR_DELIVERY) throw ApiException.conflict("Order isn't out for delivery.");
        completeDelivery(order);
        return toResponse(order, true);
    }

    // ------------------------------------------------------------------ reads

    @Transactional(readOnly = true)
    public OrderResponse getForUser(UserPrincipal principal, Long orderId) {
        Order order = load(orderId);
        boolean allowed = order.getUser().getId().equals(principal.id())
                || (order.getDeliveryAgent() != null && order.getDeliveryAgent().getId().equals(principal.id()))
                || principal.canManageStore(order.getDarkStore().getId());
        if (!allowed) throw ApiException.forbidden("This isn't your order.");
        boolean staff = !order.getUser().getId().equals(principal.id());
        return toResponse(order, staff);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> myOrders(UserPrincipal principal, int page) {
        Page<Order> p = orderRepository.findByUserIdAndStatusNotOrderByCreatedAtDesc(principal.id(), OrderStatus.EXPIRED,
                PageRequest.of(Math.max(page, 0), 20));
        return p.getContent().stream().map(this::toResponse).toList();
    }

    // ------------------------------------------------------------------ helpers

    public Order load(Long orderId) {
        return orderRepository.findDetailedById(orderId).orElseThrow(() -> ApiException.notFound("Order not found."));
    }

    public void transition(Order order, OrderStatus next, String note) {
        if (!order.getStatus().canTransitionTo(next)) {
            throw ApiException.conflict("Order " + order.getOrderNumber() + " can't move from "
                    + order.getStatus() + " to " + next + ".");
        }
        order.recordStatus(next, note);
        publishStatus(order);
    }

    private void publishStatus(Order order) {
        publisher.publishAfterCommit(RealtimePublisher.orderTopic(order.getId()), toResponse(order, false));
        publisher.publishAfterCommit(RealtimePublisher.storeOrdersTopic(order.getDarkStore().getId()), toResponse(order, true));
    }

    private void announceNewOrder(Order order) {
        alerts.notify(AlertService.Kind.ORDER, ":shopping_trolley: New order *" + order.getOrderNumber() + "* at "
                + order.getDarkStore().getName() + " — " + order.getItems().size() + " items, ₹" + order.getTotalAmount()
                + " (" + PaymentService.label(order.getPaymentMethod()) + ")");
    }

    private void consumeCoupon(Order order) {
        if (order.getCouponCode() == null) return;
        couponRepository.lockByCode(order.getCouponCode()).ifPresent(c -> c.setUsedCount(c.getUsedCount() + 1));
    }

    private static double distanceKm(DarkStore store, Double lat, Double lng) {
        if (lat == null || lng == null) return 1.5;
        return GeoUtils.haversineKm(store.getLatitude(), store.getLongitude(), lat, lng);
    }

    private static String nextOrderNumber() {
        String day = LocalDate.now(ZoneId.of("Asia/Kolkata")).format(DateTimeFormatter.BASIC_ISO_DATE).substring(2);
        String rand = Long.toString(ThreadLocalRandom.current().nextLong(36L * 36 * 36 * 36 * 36, 36L * 36 * 36 * 36 * 36 * 36), 36);
        return "QC" + day + rand.toUpperCase();
    }

    /** ETA assumes ~20 km/h average city speed for two-wheelers on the road distance left. */
    public TrackingUpdate tracking(Order o, double remainingKm, double roadKm) {
        Integer eta = o.getStatus() == OrderStatus.DELIVERED ? 0 : (int) Math.max(1, Math.ceil(roadKm / 20.0 * 60));
        return new TrackingUpdate(o.getId(), o.getStatus().name(), o.getRiderLatitude(), o.getRiderLongitude(),
                Math.round(remainingKm * 100) / 100.0, eta, firstName(o.getDeliveryAgent()), Instant.now(),
                o.getRiderLocationAt());
    }

    private static String firstName(User u) {
        if (u == null || u.getFullName() == null) return null;
        String[] parts = u.getFullName().trim().split("\\s+");
        return parts.length == 0 ? null : parts[0];
    }

    /** Customer view by default. */
    public OrderResponse toResponse(Order o) {
        return toResponse(o, false);
    }

    /**
     * staffView = store admins / riders: full rider name & phone and customer contact. Customers see only the
     * rider's first name and no phone number (privacy); they reach the rider through store support.
     */
    public OrderResponse toResponse(Order o, boolean staffView) {
        DarkStore s = o.getDarkStore();
        User agent = o.getDeliveryAgent();
        User customer = o.getUser();
        String agentName = agent == null ? null : staffView ? agent.getFullName() : firstName(agent);
        String agentPhone = agent == null || !staffView ? null : agent.getPhoneNumber();
        boolean showRider = o.getStatus() == OrderStatus.OUT_FOR_DELIVERY || staffView;
        return new OrderResponse(o.getId(), o.getOrderNumber(), o.getStatus().name(), o.getPaymentMethod().name(),
                o.getSubtotal(), o.getDiscountAmount(), o.getDeliveryFee(), o.getHandlingFee(), o.getTotalAmount(),
                o.getCouponCode(), o.getDeliveryAddress(), o.getDeliveryLatitude(), o.getDeliveryLongitude(),
                s.getId(), s.getName(), s.getLatitude(), s.getLongitude(),
                showRider ? o.getRiderLatitude() : null, showRider ? o.getRiderLongitude() : null, o.getRiderLocationAt(),
                agentName, agentPhone,
                o.getDeliveryLandmark(), o.getDeliveryContactName(), o.getDeliveryContactPhone(),
                o.getPaymentReference(), o.getRefundStatus(),
                customer.getFullName(), staffView ? customer.getPhoneNumber() : null,
                o.getCreatedAt(), o.getPaidAt(), o.getDeliveredAt(), o.getReservationExpiresAt(), o.getCancelReason(),
                o.getItems().stream().map(i -> new OrderItemResponse(i.getProduct().getId(), i.getProductTitle(),
                        i.getImageUrl(), i.getUnitQuantity(), i.getUnitPrice(), i.getQuantity(), i.getTotalPrice())).toList(),
                o.getHistory().stream().map(h -> new StatusEvent(h.getStatus().name(), h.getNote(), h.getCreatedAt())).toList());
    }
}
