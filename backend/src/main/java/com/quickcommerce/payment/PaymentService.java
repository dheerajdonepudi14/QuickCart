package com.quickcommerce.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickcommerce.config.AppProperties;
import com.quickcommerce.config.PaymentProperties;
import com.quickcommerce.dto.PaymentDtos.*;
import com.quickcommerce.entity.Order;
import com.quickcommerce.entity.PaymentMethod;
import com.quickcommerce.entity.PaymentTransaction;
import com.quickcommerce.entity.User;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.integration.AlertService;
import com.quickcommerce.repository.PaymentTransactionRepository;
import com.quickcommerce.service.StripeGateway;
import com.stripe.model.PaymentIntent;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Gateway-agnostic payment operations: starting a payment session, recording attempts, reconciling with the
 * gateway and refunding. It never changes order status itself (OrderService owns the state machine), which
 * keeps the dependency graph acyclic: OrderService → PaymentService → gateway clients.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    public enum PaidState { PAID, PENDING, FAILED, UNKNOWN }

    public record Reconciliation(PaidState state, String paymentId, String detail) {}

    private final StripeGateway stripe;
    private final RazorpayClient razorpay;
    private final PhonePeClient phonepe;
    private final PaymentProperties props;
    private final AppProperties app;
    private final PaymentTransactionRepository transactions;
    private final ObjectMapper mapper;
    private final MeterRegistry meters;
    private final AlertService alerts;

    // ------------------------------------------------------------------ availability

    public PaymentConfigResponse config() {
        boolean upiDirect = props.upi().enabled();
        String upiMode = razorpay.enabled() ? "RAZORPAY" : upiDirect ? "DIRECT" : "DISABLED";
        return new PaymentConfigResponse(stripe.enabled(), razorpay.enabled(), props.razorpay().testMode(),
                razorpay.enabled() ? razorpay.keyId() : null, phonepe.enabled(), phonepe.sandbox(),
                razorpay.enabled() || upiDirect, upiMode, true, true);
    }

    public void ensureAvailable(PaymentMethod method) {
        boolean ok = switch (method) {
            case STRIPE -> stripe.enabled();
            case RAZORPAY -> razorpay.enabled();
            case PHONEPE -> phonepe.enabled();
            case UPI -> razorpay.enabled() || props.upi().enabled();
            case MOCK_ONLINE, CASH_ON_DELIVERY -> true;
        };
        if (!ok) {
            throw ApiException.badRequest(label(method) + " isn't set up on this store yet. Choose another payment method.");
        }
    }

    public static String label(PaymentMethod m) {
        return switch (m) {
            case STRIPE -> "Card payment";
            case RAZORPAY -> "Razorpay";
            case PHONEPE -> "PhonePe";
            case UPI -> "UPI / Google Pay";
            case MOCK_ONLINE -> "Mock pay";
            case CASH_ON_DELIVERY -> "Cash on delivery";
        };
    }

    /** Which gateway actually processes a method (UPI goes through Razorpay when it is configured). */
    public String gatewayFor(PaymentMethod m) {
        return switch (m) {
            case STRIPE -> "STRIPE";
            case RAZORPAY -> "RAZORPAY";
            case PHONEPE -> "PHONEPE";
            case UPI -> razorpay.enabled() ? "RAZORPAY" : "UPI";
            case MOCK_ONLINE -> "MOCK";
            case CASH_ON_DELIVERY -> "COD";
        };
    }

    // ------------------------------------------------------------------ sessions

    /**
     * Creates (or re-uses) the gateway-side order for an unpaid order and returns what the browser needs.
     * Called inside the checkout transaction, so a gateway failure rolls the stock reservation back.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public PaymentSession startSession(Order order) {
        PaymentMethod method = order.getPaymentMethod();
        Instant expires = order.getReservationExpiresAt();
        String gateway = gatewayFor(method);
        return switch (gateway) {
            case "COD" -> new PaymentSession("NONE", "COD", null, null, null, null, null);
            case "MOCK" -> {
                record(order, "MOCK", order.getOrderNumber(), PaymentTransaction.PENDING, null);
                yield new PaymentSession("MOCK", "MOCK", null, null, null, null, expires);
            }
            case "STRIPE" -> {
                PaymentIntent intent = order.getStripePaymentIntentId() != null
                        ? stripe.retrieve(order.getStripePaymentIntentId())
                        : stripe.createIntent(order);
                order.setStripePaymentIntentId(intent.getId());
                order.setPaymentReference(intent.getId());
                record(order, "STRIPE", intent.getId(), PaymentTransaction.PENDING, null);
                yield new PaymentSession("STRIPE", "STRIPE", intent.getClientSecret(), null, null, null, expires);
            }
            case "RAZORPAY" -> {
                String rzpOrderId = order.getPaymentReference();
                if (rzpOrderId == null || !rzpOrderId.startsWith("order_")) {
                    Map<String, String> notes = new LinkedHashMap<>();
                    notes.put("orderId", String.valueOf(order.getId()));
                    notes.put("orderNumber", order.getOrderNumber());
                    JsonNode created = razorpay.createOrder(order.getOrderNumber(), Crypto.toPaise(order.getTotalAmount()), notes);
                    rzpOrderId = created.path("id").asText();
                    order.setPaymentReference(rzpOrderId);
                    record(order, "RAZORPAY", rzpOrderId, PaymentTransaction.CREATED, created.toString());
                }
                User u = order.getUser();
                RazorpayCheckout checkout = new RazorpayCheckout(razorpay.keyId(), rzpOrderId,
                        Crypto.toPaise(order.getTotalAmount()), "INR", businessName(),
                        "Order " + order.getOrderNumber(), u.getFullName(), u.getEmail(),
                        firstNonBlank(order.getDeliveryContactPhone(), u.getPhoneNumber()), themeColor(),
                        method == PaymentMethod.UPI ? "upi" : null, props.razorpay().testMode());
                yield new PaymentSession("RAZORPAY", "RAZORPAY", null, checkout, null, null, expires);
            }
            case "PHONEPE" -> {
                long attempt = transactions.countByOrderId(order.getId()) + 1;
                String merchantOrderId = attempt == 1 ? order.getOrderNumber() : order.getOrderNumber() + "-" + attempt;
                String redirect = app.frontendUrl() + "/orders/" + order.getId() + "/track?payment=phonepe";
                JsonNode res = phonepe.pay(merchantOrderId, Crypto.toPaise(order.getTotalAmount()), redirect, order.getOrderNumber());
                String redirectUrl = res.path("redirectUrl").asText(null);
                if (redirectUrl == null) throw new GatewayException("PhonePe didn't return a checkout page. Try again.", "NO_REDIRECT");
                order.setPaymentReference(merchantOrderId);
                PaymentTransaction tx = record(order, "PHONEPE", merchantOrderId, PaymentTransaction.PENDING, res.toString());
                tx.setAttempt((int) attempt);
                yield new PaymentSession("PHONEPE", "PHONEPE", null, null,
                        new PhonePeCheckout(redirectUrl, merchantOrderId, phonepe.sandbox()), null, expires);
            }
            case "UPI" -> {
                String ref = order.getOrderNumber();
                order.setPaymentReference(ref);
                record(order, "UPI", ref, PaymentTransaction.PENDING, null);
                yield new PaymentSession("UPI", "UPI", null, null, null, upiCheckout(order, ref), expires);
            }
            default -> throw ApiException.badRequest("Unsupported payment method.");
        };
    }

    UpiCheckout upiCheckout(Order order, String ref) {
        PaymentProperties.Upi upi = props.upi();
        BigDecimal amount = order.getTotalAmount().setScale(2, RoundingMode.HALF_UP);
        StringBuilder q = new StringBuilder()
                .append("pa=").append(enc(upi.vpa()))
                .append("&pn=").append(enc(upi.name()))
                .append("&am=").append(amount.toPlainString())
                .append("&cu=INR")
                .append("&tn=").append(enc("QuickCart order " + order.getOrderNumber()))
                .append("&tr=").append(enc(ref));
        if (upi.merchantCode() != null && !upi.merchantCode().isBlank()) q.append("&mc=").append(enc(upi.merchantCode()));
        String query = q.toString();
        Map<String, String> apps = new LinkedHashMap<>();
        apps.put("Google Pay", "tez://upi/pay?" + query);
        apps.put("PhonePe", "phonepe://pay?" + query);
        apps.put("Paytm", "paytmmp://pay?" + query);
        apps.put("BHIM / any UPI app", "upi://pay?" + query);
        return new UpiCheckout("upi://pay?" + query, apps, upi.vpa(), upi.name(), amount, ref, upi.autoConfirm());
    }

    // ------------------------------------------------------------------ attempt bookkeeping

    @Transactional(propagation = Propagation.MANDATORY)
    public PaymentTransaction record(Order order, String gateway, String gatewayOrderId, String status, String raw) {
        PaymentTransaction tx = gatewayOrderId == null ? null
                : transactions.findByGatewayAndGatewayOrderId(gateway, gatewayOrderId).orElse(null);
        if (tx == null) {
            tx = new PaymentTransaction();
            tx.setOrder(order);
            tx.setGateway(gateway);
            tx.setGatewayOrderId(gatewayOrderId);
            tx.setAmount(order.getTotalAmount());
        }
        tx.setStatus(status);
        if (raw != null) tx.setRawResponse(safeJson(raw));
        return transactions.save(tx);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void markSucceeded(Order order, String gateway, String paymentId, String raw) {
        PaymentTransaction tx = latest(order, gateway).orElseGet(() -> record(order, gateway, order.getPaymentReference(),
                PaymentTransaction.PENDING, null));
        if (!PaymentTransaction.SUCCESS.equals(tx.getStatus())) {
            meters.counter("quickcart.payments", "gateway", gateway, "outcome", "success").increment();
        }
        tx.setStatus(PaymentTransaction.SUCCESS);
        if (paymentId != null) tx.setGatewayPaymentId(paymentId);
        if (raw != null) tx.setRawResponse(safeJson(raw));
        tx.setFailureReason(null);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void markFailed(Order order, String gateway, String reason) {
        latest(order, gateway).ifPresent(tx -> {
            if (PaymentTransaction.SUCCESS.equals(tx.getStatus())) return;
            tx.setStatus(PaymentTransaction.FAILED);
            tx.setFailureReason(truncate(reason, 300));
        });
        meters.counter("quickcart.payments", "gateway", gateway, "outcome", "failed").increment();
        alerts.notify(AlertService.Kind.PAYMENT, ":warning: Payment failed for order *" + order.getOrderNumber()
                + "* via " + gateway + " — " + reason);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void markPendingVerification(Order order, String utr) {
        PaymentTransaction tx = latest(order, "UPI").orElseThrow(() -> ApiException.badRequest("No UPI payment on this order."));
        if (PaymentTransaction.SUCCESS.equals(tx.getStatus())) return;
        tx.setStatus(PaymentTransaction.PENDING_VERIFICATION);
        if (utr != null && !utr.isBlank()) tx.setGatewayPaymentId(utr.trim());
        alerts.notify(AlertService.Kind.PAYMENT, ":mag: UPI payment to verify for order *" + order.getOrderNumber()
                + "* — ₹" + order.getTotalAmount() + (utr != null && !utr.isBlank() ? " (UTR " + utr + ")" : ""));
    }

    public Optional<PaymentTransaction> latest(Order order, String gateway) {
        return transactions.findByOrderIdOrderByCreatedAtDesc(order.getId()).stream()
                .filter(t -> gateway == null || gateway.equals(t.getGateway())).findFirst();
    }

    public List<TransactionView> history(Long orderId) {
        return transactions.findByOrderIdOrderByCreatedAtDesc(orderId).stream()
                .map(t -> new TransactionView(t.getId(), t.getGateway(), t.getGatewayOrderId(), t.getGatewayPaymentId(),
                        t.getStatus(), t.getAmount(), t.getRefundId(), t.getRefundAmount(), t.getFailureReason(),
                        t.getCreatedAt(), t.getUpdatedAt()))
                .toList();
    }

    public String paymentState(Order order) {
        return latest(order, null).map(PaymentTransaction::getStatus)
                .orElse(order.getPaidAt() != null ? PaymentTransaction.SUCCESS : null);
    }

    // ------------------------------------------------------------------ reconciliation

    /** Asks the gateway whether money arrived — used before a reservation is released and by status polls. */
    public Reconciliation reconcile(Order order) {
        String gateway = gatewayFor(order.getPaymentMethod());
        try {
            switch (gateway) {
                case "STRIPE": {
                    if (order.getStripePaymentIntentId() == null || !stripe.enabled()) break;
                    String st = stripe.retrieve(order.getStripePaymentIntentId()).getStatus();
                    if ("succeeded".equals(st)) return new Reconciliation(PaidState.PAID, order.getStripePaymentIntentId(), st);
                    if ("processing".equals(st)) return new Reconciliation(PaidState.PENDING, null, st);
                    if ("canceled".equals(st)) return new Reconciliation(PaidState.FAILED, null, st);
                    return new Reconciliation(PaidState.UNKNOWN, null, st);
                }
                case "RAZORPAY": {
                    String ref = order.getPaymentReference();
                    if (ref == null || !razorpay.enabled()) break;
                    JsonNode items = razorpay.fetchOrderPayments(ref).path("items");
                    boolean failedSeen = false;
                    for (JsonNode p : items) {
                        String st = p.path("status").asText();
                        String pid = p.path("id").asText();
                        if ("captured".equals(st)) return new Reconciliation(PaidState.PAID, pid, st);
                        if ("authorized".equals(st)) {
                            razorpay.capture(pid, Crypto.toPaise(order.getTotalAmount()));
                            return new Reconciliation(PaidState.PAID, pid, "captured");
                        }
                        if ("failed".equals(st)) failedSeen = true;
                    }
                    return new Reconciliation(failedSeen ? PaidState.FAILED : PaidState.UNKNOWN, null, null);
                }
                case "PHONEPE": {
                    String ref = order.getPaymentReference();
                    if (ref == null || !phonepe.enabled()) break;
                    JsonNode res = phonepe.status(ref);
                    String st = res.path("state").asText();
                    String txId = res.path("paymentDetails").path(0).path("transactionId").asText(null);
                    return switch (st) {
                        case "COMPLETED" -> new Reconciliation(PaidState.PAID, txId, st);
                        case "FAILED" -> new Reconciliation(PaidState.FAILED, txId, res.path("errorCode").asText(st));
                        default -> new Reconciliation(PaidState.PENDING, null, st);
                    };
                }
                case "UPI": {
                    Optional<PaymentTransaction> tx = latest(order, "UPI");
                    if (tx.isPresent() && PaymentTransaction.PENDING_VERIFICATION.equals(tx.get().getStatus())) {
                        return new Reconciliation(PaidState.PENDING, tx.get().getGatewayPaymentId(), "awaiting verification");
                    }
                    break;
                }
                default:
                    break;
            }
        } catch (ApiException e) {
            log.warn("Reconciliation for {} via {} failed: {}", order.getOrderNumber(), gateway, e.getMessage());
            return new Reconciliation(PaidState.UNKNOWN, null, e.getMessage());
        }
        return new Reconciliation(PaidState.UNKNOWN, null, null);
    }

    // ------------------------------------------------------------------ refunds

    /**
     * Refunds a paid order through the gateway that took the money. Never throws: a failed refund is recorded
     * (REFUND_FAILED + Slack alert) so cancellation itself still succeeds and ops can retry.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void refund(Order order, String reason) {
        if (!order.getPaymentMethod().online()) return;
        PaymentTransaction tx = transactions.findByOrderIdOrderByCreatedAtDesc(order.getId()).stream()
                .filter(t -> PaymentTransaction.SUCCESS.equals(t.getStatus())).findFirst().orElse(null);
        if (tx == null) {
            // Orders paid before payment_transactions existed (Stripe only).
            if (order.getPaidAt() != null && order.getStripePaymentIntentId() != null) {
                stripe.refund(order.getStripePaymentIntentId());
                order.setRefundStatus("REFUNDED");
            }
            return;
        }
        long paise = Crypto.toPaise(tx.getAmount());
        tx.setRefundAmount(tx.getAmount());
        try {
            switch (tx.getGateway()) {
                case "STRIPE" -> {
                    stripe.refund(tx.getGatewayOrderId());
                    tx.setStatus(PaymentTransaction.REFUNDED);
                }
                case "RAZORPAY" -> {
                    if (tx.getGatewayPaymentId() == null) throw ApiException.badRequest("Missing Razorpay payment id");
                    JsonNode r = razorpay.refund(tx.getGatewayPaymentId(), paise, "rf_" + order.getOrderNumber());
                    tx.setRefundId(r.path("id").asText(null));
                    tx.setStatus("processed".equals(r.path("status").asText()) ? PaymentTransaction.REFUNDED
                            : PaymentTransaction.REFUND_PENDING);
                }
                case "PHONEPE" -> {
                    String refundId = "RF" + tx.getGatewayOrderId();
                    JsonNode r = phonepe.refund(refundId, tx.getGatewayOrderId(), paise);
                    tx.setRefundId(refundId);
                    tx.setStatus("COMPLETED".equals(r.path("state").asText()) ? PaymentTransaction.REFUNDED
                            : PaymentTransaction.REFUND_PENDING);
                }
                case "UPI" -> {
                    tx.setStatus(PaymentTransaction.REFUND_PENDING);
                    tx.setFailureReason("Direct UPI: refund manually to the payer's UPI ID");
                    alerts.notify(AlertService.Kind.PAYMENT, ":money_with_wings: Manual UPI refund needed for order *"
                            + order.getOrderNumber() + "* — ₹" + tx.getAmount() + " (UTR " + tx.getGatewayPaymentId() + ")");
                }
                default -> tx.setStatus(PaymentTransaction.REFUNDED); // MOCK
            }
            order.setRefundStatus(PaymentTransaction.REFUNDED.equals(tx.getStatus()) ? "REFUNDED" : "PENDING");
            meters.counter("quickcart.refunds", "gateway", tx.getGateway(), "outcome", "initiated").increment();
            log.info("Refund for {} via {} → {} ({})", order.getOrderNumber(), tx.getGateway(), tx.getStatus(), reason);
        } catch (RuntimeException e) {
            tx.setStatus(PaymentTransaction.REFUND_FAILED);
            tx.setFailureReason(truncate("Refund failed: " + e.getMessage(), 300));
            order.setRefundStatus("FAILED");
            meters.counter("quickcart.refunds", "gateway", tx.getGateway(), "outcome", "failed").increment();
            log.error("Refund for {} via {} failed", order.getOrderNumber(), tx.getGateway(), e);
            alerts.notify(AlertService.Kind.PAYMENT, ":rotating_light: Refund FAILED for order *" + order.getOrderNumber()
                    + "* via " + tx.getGateway() + ": " + e.getMessage());
        }
    }

    /** Applies a refund outcome reported by a webhook. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void applyRefundOutcome(PaymentTransaction tx, boolean success, String detail) {
        tx.setStatus(success ? PaymentTransaction.REFUNDED : PaymentTransaction.REFUND_FAILED);
        if (!success) tx.setFailureReason(truncate(detail, 300));
        tx.getOrder().setRefundStatus(success ? "REFUNDED" : "FAILED");
        if (!success) {
            alerts.notify(AlertService.Kind.PAYMENT, ":rotating_light: Gateway reported refund failure for order *"
                    + tx.getOrder().getOrderNumber() + "*: " + detail);
        }
    }

    // ------------------------------------------------------------------ helpers

    String safeJson(String raw) {
        try {
            mapper.readTree(raw);
            return raw;
        } catch (Exception e) {
            try {
                return mapper.writeValueAsString(Map.of("raw", raw));
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private String businessName() {
        String n = props.razorpay().businessName();
        return n == null || n.isBlank() ? "QuickCart" : n;
    }

    private String themeColor() {
        String c = props.razorpay().themeColor();
        return c == null || c.isBlank() ? "#22A04B" : c;
    }

    private static String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }

    private static String truncate(String s, int max) {
        return s == null ? null : s.length() <= max ? s : s.substring(0, max);
    }

    private static String enc(String v) {
        return URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
