package com.quickcommerce.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

public final class PaymentDtos {
    private PaymentDtos() {}

    /** Options for Razorpay Checkout.js (https://checkout.razorpay.com/v1/checkout.js). */
    public record RazorpayCheckout(String keyId, String orderId, long amount, String currency, String name,
                                   String description, String prefillName, String prefillEmail, String prefillContact,
                                   String themeColor, String preferredMethod, boolean testMode) {}

    /** PhonePe hosted checkout: the browser is redirected to redirectUrl and comes back to the tracking page. */
    public record PhonePeCheckout(String redirectUrl, String merchantOrderId, boolean sandbox) {}

    /** Direct UPI: a upi:// intent (mobile) and the same URI rendered as a QR code (desktop). */
    public record UpiCheckout(String uri, Map<String, String> appUris, String vpa, String payeeName,
                              BigDecimal amount, String reference, boolean sandboxAutoConfirm) {}

    /**
     * What the browser needs to collect payment. mode = STRIPE | RAZORPAY | PHONEPE | UPI | MOCK | NONE.
     */
    public record PaymentSession(String mode, String gateway, String stripeClientSecret, RazorpayCheckout razorpay,
                                 PhonePeCheckout phonepe, UpiCheckout upi, Instant expiresAt) {}

    public record RazorpayVerifyRequest(@NotBlank String razorpayOrderId,
                                        @NotBlank String razorpayPaymentId,
                                        @NotBlank String razorpaySignature) {}

    /** UTR = 12-digit UPI transaction reference shown in the payer's UPI app (optional). */
    public record UpiSubmitRequest(@Pattern(regexp = "^$|^[0-9]{12}$", message = "UTR must be 12 digits") String utr) {}

    public record PaymentStatusResponse(Long orderId, String orderNumber, String orderStatus, String paymentMethod,
                                        String gateway, String paymentState, String refundStatus, String message,
                                        Instant reservationExpiresAt) {}

    public record PaymentConfigResponse(boolean stripeEnabled, boolean razorpayEnabled, boolean razorpayTestMode,
                                        String razorpayKeyId, boolean phonepeEnabled, boolean phonepeSandbox,
                                        boolean upiEnabled, String upiMode, boolean mockEnabled, boolean codEnabled) {}

    public record TransactionView(Long id, String gateway, String gatewayOrderId, String gatewayPaymentId, String status,
                                  BigDecimal amount, String refundId, BigDecimal refundAmount, String failureReason,
                                  Instant createdAt, Instant updatedAt) {}
}
