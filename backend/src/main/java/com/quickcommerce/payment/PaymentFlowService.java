package com.quickcommerce.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickcommerce.config.PaymentProperties;
import com.quickcommerce.dto.OrderDtos.OrderResponse;
import com.quickcommerce.dto.PaymentDtos.*;
import com.quickcommerce.entity.*;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.integration.AlertService;
import com.quickcommerce.repository.PaymentTransactionRepository;
import com.quickcommerce.security.UserPrincipal;
import com.quickcommerce.service.OrderService;
import com.quickcommerce.service.StripeGateway;
import com.stripe.model.Event;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Payment use-cases that need both the order state machine and the gateways: client-side verification,
 * status polling, retries, direct-UPI verification and webhook processing for Razorpay, PhonePe and Stripe.
 */
@Slf4j
@Service
public class PaymentFlowService {

    private final OrderService orderService;
    private final PaymentService payments;
    private final RazorpayClient razorpay;
    private final PhonePeClient phonepe;
    private final StripeGateway stripe;
    private final WebhookInbox inbox;
    private final PaymentTransactionRepository transactions;
    private final PaymentProperties props;
    private final AlertService alerts;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;

    public PaymentFlowService(OrderService orderService, PaymentService payments, RazorpayClient razorpay,
                              PhonePeClient phonepe, StripeGateway stripe, WebhookInbox inbox,
                              PaymentTransactionRepository transactions, PaymentProperties props,
                              AlertService alerts, ObjectMapper mapper, PlatformTransactionManager txManager) {
        this.orderService = orderService;
        this.payments = payments;
        this.razorpay = razorpay;
        this.phonepe = phonepe;
        this.stripe = stripe;
        this.inbox = inbox;
        this.transactions = transactions;
        this.props = props;
        this.alerts = alerts;
        this.mapper = mapper;
        this.tx = new TransactionTemplate(txManager);
    }

    // ------------------------------------------------------------------ shopper-facing

    /** Razorpay Checkout handler → verify signature, confirm status/amount with the API, then confirm the order. */
    @Transactional
    public OrderResponse verifyRazorpay(UserPrincipal user, Long orderId, RazorpayVerifyRequest req) {
        Order order = orderService.loadForPayment(orderId, user);
        if (!req.razorpayOrderId().equals(order.getPaymentReference())) {
            throw ApiException.badRequest("This payment doesn't belong to this order.");
        }
        if (!razorpay.verifyPaymentSignature(req.razorpayOrderId(), req.razorpayPaymentId(), req.razorpaySignature())) {
            log.warn("Razorpay signature mismatch for order {}", order.getOrderNumber());
            alerts.notify(AlertService.Kind.PAYMENT, ":lock: Razorpay signature mismatch on order *" + order.getOrderNumber() + "*");
            throw ApiException.badRequest("We couldn't verify this payment. If money was debited, it will be refunded automatically.");
        }
        if (order.getPaidAt() != null) return orderService.toResponse(order);
        JsonNode payment = razorpay.fetchPayment(req.razorpayPaymentId());
        String status = payment.path("status").asText();
        if ("authorized".equals(status)) {
            payment = razorpay.capture(req.razorpayPaymentId(), Crypto.toPaise(order.getTotalAmount()));
            status = payment.path("status").asText("captured");
        }
        if (payment.path("amount").asLong(-1) != Crypto.toPaise(order.getTotalAmount())) {
            alerts.notify(AlertService.Kind.PAYMENT, ":rotating_light: Amount mismatch on order *" + order.getOrderNumber()
                    + "* (paid " + payment.path("amount").asLong() + " paise)");
            throw ApiException.badRequest("The paid amount doesn't match this order. Our team has been alerted.");
        }
        if (!"captured".equals(status)) {
            if ("failed".equals(status)) {
                payments.markFailed(order, "RAZORPAY", payment.path("error_description").asText("Payment failed"));
                throw ApiException.badRequest("The payment failed. You can try again before your items are released.");
            }
            return orderService.toResponse(order); // still processing — webhook will finish it
        }
        payments.markSucceeded(order, "RAZORPAY", req.razorpayPaymentId(), payment.toString());
        return orderService.confirmPayment(orderId, "Razorpay (" + payment.path("method").asText("online") + ")");
    }

    /** Starts a fresh payment attempt (closed checkout window, failed UPI, PhonePe retry…). */
    @Transactional
    public PaymentSession retrySession(UserPrincipal user, Long orderId) {
        Order order = orderService.loadForPayment(orderId, user);
        if (order.getStatus() != OrderStatus.CREATED) {
            throw ApiException.conflict(order.getPaidAt() != null ? "This order is already paid."
                    : "This order can no longer be paid. Please place a new order.");
        }
        if (order.getReservationExpiresAt() != null && order.getReservationExpiresAt().isBefore(Instant.now())) {
            throw ApiException.conflict("Your reservation expired. Please place a new order.");
        }
        return payments.startSession(order);
    }

    /** Polled by the browser: reconciles with the gateway while the order is still waiting for money. */
    @Transactional
    public PaymentStatusResponse status(UserPrincipal user, Long orderId) {
        Order order = orderService.loadForPayment(orderId, user);
        return statusOf(order, true);
    }

    PaymentStatusResponse statusOf(Order order, boolean reconcile) {
        String gateway = payments.gatewayFor(order.getPaymentMethod());
        String message = null;
        if (reconcile && order.getStatus() == OrderStatus.CREATED
                && ("PHONEPE".equals(gateway) || "RAZORPAY".equals(gateway) || "STRIPE".equals(gateway))) {
            PaymentService.Reconciliation r = payments.reconcile(order);
            if (r.state() == PaymentService.PaidState.PAID) {
                payments.markSucceeded(order, gateway, r.paymentId(), null);
                orderService.confirmPayment(order.getId(), PaymentService.label(order.getPaymentMethod()));
            } else if (r.state() == PaymentService.PaidState.FAILED) {
                payments.markFailed(order, gateway, r.detail() == null ? "Payment failed" : r.detail());
                message = "Payment failed. You can retry before the reservation ends.";
            }
        }
        String state = payments.paymentState(order);
        if (message == null && PaymentTransaction.PENDING_VERIFICATION.equals(state)) {
            message = props.upi().autoConfirm() ? "Confirming your UPI payment…" : "Waiting for the store to verify your UPI payment";
        }
        return new PaymentStatusResponse(order.getId(), order.getOrderNumber(), order.getStatus().name(),
                order.getPaymentMethod().name(), gateway, state, order.getRefundStatus(), message,
                order.getReservationExpiresAt());
    }

    /** Direct UPI: the shopper says they paid (optionally with the 12-digit UTR) — goes to verification. */
    @Transactional
    public PaymentStatusResponse upiSubmitted(UserPrincipal user, Long orderId, String utr) {
        Order order = orderService.loadForPayment(orderId, user);
        if (!"UPI".equals(payments.gatewayFor(order.getPaymentMethod()))) throw ApiException.badRequest("This order isn't a UPI payment.");
        if (order.getStatus() != OrderStatus.CREATED) return statusOf(order, false);
        payments.markPendingVerification(order, utr);
        // Keep the stock while the payment is verified (one extension of 10 minutes).
        Instant minHold = Instant.now().plus(Duration.ofMinutes(10));
        if (order.getReservationExpiresAt() != null && order.getReservationExpiresAt().isBefore(minHold)) {
            order.setReservationExpiresAt(minHold);
        }
        return statusOf(order, false);
    }

    /** Store admin approves / rejects a direct UPI payment after checking the bank statement. */
    @Transactional
    public OrderResponse verifyUpiByStore(Long orderId, boolean approve, String note) {
        Order order = orderService.load(orderId);
        if (!"UPI".equals(payments.gatewayFor(order.getPaymentMethod()))) throw ApiException.badRequest("Not a direct UPI order.");
        if (approve) {
            payments.markSucceeded(order, "UPI", null, null);
            return orderService.confirmPayment(orderId, "UPI (verified by store)");
        }
        payments.markFailed(order, "UPI", note == null || note.isBlank() ? "Payment not received" : note);
        return orderService.failPayment(orderId, "UPI payment could not be verified; stock released");
    }

    /** Sandbox only: auto-approves submitted direct-UPI payments after a short delay so demos flow end to end. */
    public void autoConfirmSandboxUpi() {
        if (!props.upi().enabled() || !props.upi().autoConfirm()) return;
        Instant cutoff = Instant.now().minusSeconds(props.upi().confirmSeconds());
        List<PaymentTransaction> pending = transactions.findByGatewayAndStatus("UPI", PaymentTransaction.PENDING_VERIFICATION);
        for (PaymentTransaction t : pending) {
            if (t.getUpdatedAt().isAfter(cutoff)) continue;
            Long orderId = t.getOrder().getId();
            try {
                tx.executeWithoutResult(s -> {
                    Order order = orderService.load(orderId);
                    if (order.getStatus() == OrderStatus.CREATED || order.getStatus() == OrderStatus.EXPIRED) {
                        payments.markSucceeded(order, "UPI", null, null);
                        orderService.confirmPayment(orderId, "UPI (sandbox auto-confirm)");
                    } else {
                        payments.markSucceeded(order, "UPI", null, null);
                    }
                });
            } catch (RuntimeException e) {
                log.warn("Sandbox UPI confirm failed for order {}: {}", orderId, e.getMessage());
            }
        }
    }

    // ------------------------------------------------------------------ webhooks

    public void receiveRazorpay(String body, String signature, String eventIdHeader) {
        if (!razorpay.verifyWebhookSignature(body, signature)) throw ApiException.badRequest("Invalid Razorpay signature.");
        JsonNode json = readTree(body);
        String type = json.path("event").asText("unknown");
        String eventId = eventIdHeader != null && !eventIdHeader.isBlank() ? eventIdHeader : Crypto.sha256Hex(body);
        inbox.receive("RAZORPAY", eventId, type, body).ifPresent(this::process);
    }

    public void receivePhonePe(String body, String authorization) {
        if (!phonepe.verifyWebhook(authorization)) throw ApiException.badRequest("Invalid PhonePe callback authorization.");
        JsonNode json = readTree(body);
        String type = json.path("event").asText(json.path("type").asText("unknown"));
        JsonNode p = json.path("payload");
        String key = p.path("merchantRefundId").asText(p.path("merchantOrderId").asText(""));
        String eventId = type + ":" + key + ":" + p.path("state").asText("");
        inbox.receive("PHONEPE", eventId, type, body).ifPresent(this::process);
    }

    public void receiveStripe(String body, String signature) {
        Event event = stripe.verifyWebhook(body, signature);
        inbox.receive("STRIPE", event.getId(), event.getType(), body).ifPresent(this::process);
    }

    /** Processes a stored event in its own transaction; failures are parked for retry, never lost. */
    public void process(WebhookEvent ev) {
        try {
            Boolean handled = tx.execute(s -> switch (ev.getGateway()) {
                case "RAZORPAY" -> processRazorpay(ev.getEventType(), readTree(ev.getPayload()));
                case "PHONEPE" -> processPhonePe(ev.getEventType(), readTree(ev.getPayload()));
                case "STRIPE" -> processStripe(ev.getEventType(), readTree(ev.getPayload()));
                default -> false;
            });
            inbox.markProcessed(ev.getId(), !Boolean.TRUE.equals(handled));
        } catch (RuntimeException e) {
            inbox.markFailed(ev.getId(), e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    public void retryDueWebhooks() {
        for (Long id : inbox.dueForRetry()) {
            inbox.find(id).ifPresent(this::process);
        }
    }

    private boolean processRazorpay(String type, JsonNode json) {
        JsonNode payment = json.path("payload").path("payment").path("entity");
        JsonNode refund = json.path("payload").path("refund").path("entity");
        switch (type) {
            case "payment.captured", "order.paid", "payment.authorized" -> {
                String rzpOrderId = payment.path("order_id").asText(json.path("payload").path("order").path("entity").path("id").asText(null));
                Optional<PaymentTransaction> t = rzpOrderId == null ? Optional.empty()
                        : transactions.findByGatewayAndGatewayOrderId("RAZORPAY", rzpOrderId);
                if (t.isEmpty()) return false;
                Order order = orderService.load(t.get().getOrder().getId());
                String paymentId = payment.path("id").asText(null);
                if ("payment.authorized".equals(type) && paymentId != null) {
                    razorpay.capture(paymentId, Crypto.toPaise(order.getTotalAmount()));
                }
                payments.markSucceeded(order, "RAZORPAY", paymentId, payment.toString());
                orderService.confirmPayment(order.getId(), "Razorpay webhook");
                return true;
            }
            case "payment.failed" -> {
                String rzpOrderId = payment.path("order_id").asText(null);
                Optional<PaymentTransaction> t = rzpOrderId == null ? Optional.empty()
                        : transactions.findByGatewayAndGatewayOrderId("RAZORPAY", rzpOrderId);
                if (t.isEmpty()) return false;
                Order order = orderService.load(t.get().getOrder().getId());
                payments.markFailed(order, "RAZORPAY", payment.path("error_description").asText("Payment failed"));
                return true;
            }
            case "refund.processed", "refund.failed" -> {
                Optional<PaymentTransaction> t = transactions.findFirstByGatewayAndRefundId("RAZORPAY", refund.path("id").asText(""))
                        .or(() -> transactions.findFirstByGatewayAndGatewayPaymentId("RAZORPAY", refund.path("payment_id").asText("")));
                if (t.isEmpty()) return false;
                if (t.get().getRefundId() == null) t.get().setRefundId(refund.path("id").asText(null));
                payments.applyRefundOutcome(t.get(), "refund.processed".equals(type), type);
                return true;
            }
            default -> {
                return false;
            }
        }
    }

    private boolean processPhonePe(String type, JsonNode json) {
        JsonNode p = json.path("payload");
        if (type.startsWith("checkout.order.")) {
            Optional<PaymentTransaction> t = transactions.findByGatewayAndGatewayOrderId("PHONEPE", p.path("merchantOrderId").asText(""));
            if (t.isEmpty()) return false;
            Order order = orderService.load(t.get().getOrder().getId());
            String state = p.path("state").asText();
            if ("checkout.order.completed".equals(type) || "COMPLETED".equals(state)) {
                payments.markSucceeded(order, "PHONEPE", p.path("paymentDetails").path(0).path("transactionId").asText(null), p.toString());
                orderService.confirmPayment(order.getId(), "PhonePe");
            } else {
                payments.markFailed(order, "PHONEPE", p.path("errorCode").asText("Payment failed on PhonePe"));
            }
            return true;
        }
        if (type.startsWith("pg.refund.")) {
            Optional<PaymentTransaction> t = transactions.findFirstByGatewayAndRefundId("PHONEPE", p.path("merchantRefundId").asText(""));
            if (t.isEmpty()) return false;
            String state = p.path("state").asText();
            if ("COMPLETED".equals(state) || type.endsWith("completed")) payments.applyRefundOutcome(t.get(), true, type);
            else if ("FAILED".equals(state) || type.endsWith("failed")) payments.applyRefundOutcome(t.get(), false, type);
            return true;
        }
        return false;
    }

    private boolean processStripe(String type, JsonNode json) {
        JsonNode obj = json.path("data").path("object");
        String orderId = obj.path("metadata").path("orderId").asText(null);
        if (orderId == null) return false;
        Order order = orderService.load(Long.valueOf(orderId));
        switch (type) {
            case "payment_intent.succeeded" -> {
                payments.markSucceeded(order, "STRIPE", obj.path("id").asText(null), null);
                orderService.confirmPayment(order.getId(), "Stripe");
                return true;
            }
            case "payment_intent.payment_failed" -> {
                payments.markFailed(order, "STRIPE", obj.path("last_payment_error").path("message").asText("Card declined"));
                orderService.failPayment(order.getId(), "Card payment failed; stock released");
                return true;
            }
            default -> {
                return false;
            }
        }
    }

    private JsonNode readTree(String body) {
        try {
            return mapper.readTree(body);
        } catch (Exception e) {
            throw ApiException.badRequest("Malformed webhook payload.");
        }
    }
}
