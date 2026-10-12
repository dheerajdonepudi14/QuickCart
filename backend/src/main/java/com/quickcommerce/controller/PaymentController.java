package com.quickcommerce.controller;

import com.quickcommerce.dto.OrderDtos.MockPaymentRequest;
import com.quickcommerce.dto.OrderDtos.OrderResponse;
import com.quickcommerce.dto.PaymentDtos.*;
import com.quickcommerce.entity.Order;
import com.quickcommerce.entity.OrderStatus;
import com.quickcommerce.entity.PaymentMethod;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.payment.PaymentFlowService;
import com.quickcommerce.payment.PaymentService;
import com.quickcommerce.security.CurrentUser;
import com.quickcommerce.security.UserPrincipal;
import com.quickcommerce.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Payments: Razorpay (cards/UPI/netbanking/wallets), PhonePe PG, direct UPI (Google Pay & co.), Stripe,
 * a mock gateway for demos, and the three gateway webhooks.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final OrderService orderService;
    private final PaymentService payments;
    private final PaymentFlowService flow;

    @GetMapping("/config")
    public PaymentConfigResponse config() {
        return payments.config();
    }

    /** Current payment state; reconciles with the gateway while the order is still waiting for money. */
    @GetMapping("/{orderId}/status")
    public PaymentStatusResponse status(@PathVariable Long orderId) {
        return flow.status(CurrentUser.require(), orderId);
    }

    /** New payment attempt for an unpaid order (e.g. the shopper closed the payment window). */
    @PostMapping("/{orderId}/session")
    public PaymentSession session(@PathVariable Long orderId) {
        return flow.retrySession(CurrentUser.require(), orderId);
    }

    @GetMapping("/{orderId}/transactions")
    @Transactional(readOnly = true)
    public List<TransactionView> transactions(@PathVariable Long orderId) {
        orderService.getForUser(CurrentUser.require(), orderId); // access check
        return payments.history(orderId);
    }

    // ------------------------------------------------------------------ Razorpay

    @PostMapping("/razorpay/{orderId}/verify")
    public OrderResponse verifyRazorpay(@PathVariable Long orderId, @Valid @RequestBody RazorpayVerifyRequest req) {
        return flow.verifyRazorpay(CurrentUser.require(), orderId, req);
    }

    @PostMapping("/razorpay/webhook")
    public ResponseEntity<Map<String, Boolean>> razorpayWebhook(@RequestBody String payload,
                                                                @RequestHeader("X-Razorpay-Signature") String signature,
                                                                @RequestHeader(value = "X-Razorpay-Event-Id", required = false) String eventId) {
        flow.receiveRazorpay(payload, signature, eventId);
        return ResponseEntity.ok(Map.of("received", true));
    }

    // ------------------------------------------------------------------ PhonePe

    /** Called by the tracking page after PhonePe redirects back. */
    @GetMapping("/phonepe/{orderId}/status")
    public PaymentStatusResponse phonepeStatus(@PathVariable Long orderId) {
        return flow.status(CurrentUser.require(), orderId);
    }

    @PostMapping("/phonepe/webhook")
    public ResponseEntity<Map<String, Boolean>> phonepeWebhook(@RequestBody String payload,
                                                               @RequestHeader(value = "Authorization", required = false) String authorization) {
        flow.receivePhonePe(payload, authorization);
        return ResponseEntity.ok(Map.of("received", true));
    }

    // ------------------------------------------------------------------ Direct UPI

    /** The shopper finished paying in their UPI app (optionally with the 12-digit UTR). */
    @PostMapping("/upi/{orderId}/submitted")
    public PaymentStatusResponse upiSubmitted(@PathVariable Long orderId, @Valid @RequestBody(required = false) UpiSubmitRequest req) {
        return flow.upiSubmitted(CurrentUser.require(), orderId, req == null ? null : req.utr());
    }

    // ------------------------------------------------------------------ Mock & Stripe

    /** Simulated online gateway for local development and demos. */
    @PostMapping("/mock/{orderId}/confirm")
    @Transactional
    public OrderResponse mockConfirm(@PathVariable Long orderId, @RequestBody MockPaymentRequest req) {
        UserPrincipal user = CurrentUser.require();
        Order order = orderService.loadForPayment(orderId, user);
        if (order.getPaymentMethod() != PaymentMethod.MOCK_ONLINE) throw ApiException.badRequest("This order isn't using mock pay.");
        if (req.success()) {
            payments.markSucceeded(order, "MOCK", "mock_" + order.getOrderNumber(), null);
            return orderService.confirmPayment(orderId, "Mock online pay");
        }
        payments.markFailed(order, "MOCK", "Declined by mock gateway");
        return orderService.failPayment(orderId, "Payment declined by mock gateway; stock released");
    }

    /**
     * Client-side confirmation fallback: after Stripe.js confirms, the browser calls this so the order
     * advances even when webhooks can't reach localhost. The webhook remains the source of truth.
     */
    @PostMapping("/stripe/{orderId}/verify")
    @Transactional
    public OrderResponse verifyStripe(@PathVariable Long orderId) {
        UserPrincipal user = CurrentUser.require();
        Order order = orderService.loadForPayment(orderId, user);
        if (order.getStripePaymentIntentId() == null) throw ApiException.badRequest("No card payment on this order.");
        if (order.getStatus() == OrderStatus.CREATED) flow.status(user, orderId);
        return orderService.getForUser(user, orderId);
    }

    @PostMapping("/stripe/webhook")
    public ResponseEntity<Map<String, Boolean>> stripeWebhook(@RequestBody String payload,
                                                              @RequestHeader("Stripe-Signature") String signature) {
        flow.receiveStripe(payload, signature);
        return ResponseEntity.ok(Map.of("received", true));
    }
}
