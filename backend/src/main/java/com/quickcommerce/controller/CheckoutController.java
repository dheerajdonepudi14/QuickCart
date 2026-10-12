package com.quickcommerce.controller;

import com.quickcommerce.dto.OrderDtos.*;
import com.quickcommerce.entity.Coupon;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.security.CurrentUser;
import com.quickcommerce.security.UserPrincipal;
import com.quickcommerce.service.IdempotencyService;
import com.quickcommerce.service.OrderService;
import com.quickcommerce.service.PricingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/checkout")
@RequiredArgsConstructor
public class CheckoutController {

    private final OrderService orderService;
    private final IdempotencyService idempotency;
    private final PricingService pricingService;

    public record CouponView(String code, String description, String discountType, BigDecimal discountValue,
                             BigDecimal minCartValue, BigDecimal maxDiscount) {}

    /** Live bill for the cart drawer and checkout page. Public so guests see prices before logging in. */
    @PostMapping("/quote")
    public QuoteResponse quote(@Valid @RequestBody QuoteRequest req) {
        return orderService.quote(req);
    }

    @GetMapping("/coupons")
    public List<CouponView> coupons() {
        return pricingService.activeCoupons().stream().map((Coupon c) -> new CouponView(c.getCode(), c.getDescription(),
                c.getDiscountType().name(), c.getDiscountValue(), c.getMinCartValue(), c.getMaxDiscount())).toList();
    }

    /**
     * Locks and deducts stock, creates the order and starts the payment session (Stripe / Razorpay / PhonePe / UPI).
     * Send an Idempotency-Key header so a retried request returns the same order instead of a duplicate.
     */
    @PostMapping
    public ResponseEntity<CheckoutResponse> checkout(@Valid @RequestBody CheckoutRequest req,
                                                     @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        UserPrincipal user = CurrentUser.require();
        if (key == null || key.isBlank()) {
            return ResponseEntity.status(HttpStatus.CREATED).body(orderService.checkout(user, req));
        }
        if (key.length() > 100) throw ApiException.badRequest("Idempotency-Key must be at most 100 characters.");
        IdempotencyService.Claim claim = idempotency.claim(user.id(), key, req);
        if (claim.replay()) return ResponseEntity.ok(orderService.replayCheckout(user, claim.orderId()));
        try {
            CheckoutResponse res = orderService.checkout(user, req);
            idempotency.complete(user.id(), key, res.order().id());
            return ResponseEntity.status(HttpStatus.CREATED).body(res);
        } catch (RuntimeException e) {
            idempotency.release(user.id(), key);
            throw e;
        }
    }
}
