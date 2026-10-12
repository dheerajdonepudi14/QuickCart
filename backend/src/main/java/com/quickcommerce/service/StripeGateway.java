package com.quickcommerce.service;

import com.quickcommerce.config.AppProperties;
import com.quickcommerce.entity.Order;
import com.quickcommerce.exception.ApiException;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.RefundCreateParams;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/** Thin wrapper over the Stripe SDK. Contains no order logic, so it can be used from anywhere without cycles. */
@Slf4j
@Component
@RequiredArgsConstructor
public class StripeGateway {

    private final AppProperties props;

    @PostConstruct
    void init() {
        if (props.stripe().enabled()) {
            Stripe.apiKey = props.stripe().secretKey();
            log.info("Stripe payments enabled");
        } else {
            log.warn("STRIPE_SECRET_KEY not set: card payments disabled, mock online payment available");
        }
    }

    public boolean enabled() { return props.stripe().enabled(); }

    public PaymentIntent createIntent(Order order) {
        requireEnabled();
        try {
            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                    .setAmount(toMinorUnits(order.getTotalAmount()))
                    .setCurrency(props.stripe().currency())
                    .setDescription("QuickCart order " + order.getOrderNumber())
                    .putMetadata("orderId", String.valueOf(order.getId()))
                    .putMetadata("orderNumber", order.getOrderNumber())
                    .setAutomaticPaymentMethods(PaymentIntentCreateParams.AutomaticPaymentMethods.builder().setEnabled(true).build())
                    .build();
            RequestOptions opts = RequestOptions.builder().setIdempotencyKey("pi-" + order.getOrderNumber()).build();
            return PaymentIntent.create(params, opts);
        } catch (StripeException e) {
            log.error("Stripe PaymentIntent creation failed for {}", order.getOrderNumber(), e);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Card payments are unavailable right now. Choose another payment method.");
        }
    }

    public PaymentIntent retrieve(String intentId) {
        requireEnabled();
        try {
            return PaymentIntent.retrieve(intentId);
        } catch (StripeException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Couldn't confirm the payment status with Stripe. Try again.");
        }
    }

    public void refund(String intentId) {
        if (!enabled() || intentId == null) return;
        try {
            Refund.create(RefundCreateParams.builder().setPaymentIntent(intentId).build());
        } catch (StripeException e) {
            log.error("Refund failed for {}", intentId, e);
        }
    }

    public Event verifyWebhook(String payload, String signature) {
        if (props.stripe().webhookSecret() == null || props.stripe().webhookSecret().isBlank()) {
            throw ApiException.badRequest("Webhook secret not configured.");
        }
        try {
            return Webhook.constructEvent(payload, signature, props.stripe().webhookSecret());
        } catch (SignatureVerificationException e) {
            throw ApiException.badRequest("Invalid Stripe signature.");
        }
    }

    public static long toMinorUnits(BigDecimal amount) {
        return amount.movePointRight(2).longValueExact();
    }

    private void requireEnabled() {
        if (!enabled()) throw ApiException.badRequest("Card payments aren't configured. Choose mock online pay or cash on delivery.");
    }
}
