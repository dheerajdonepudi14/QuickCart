package com.quickcommerce.service;

import com.quickcommerce.config.AppProperties;
import com.quickcommerce.dto.OrderDtos.CouponResult;
import com.quickcommerce.entity.Coupon;
import com.quickcommerce.entity.DiscountType;
import com.quickcommerce.repository.CouponRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

/** Promo engine + fee policy. Pure calculation; callers decide whether stock is locked. */
@Service
@RequiredArgsConstructor
public class PricingService {

    private final CouponRepository couponRepository;
    private final AppProperties props;

    public record Breakdown(BigDecimal subtotal, BigDecimal couponDiscount, BigDecimal deliveryFee,
                            BigDecimal handlingFee, BigDecimal total, BigDecimal amountForFreeDelivery,
                            CouponResult coupon) {}

    public Breakdown price(BigDecimal subtotal, String couponCode, double distanceKm) {
        var cfg = props.checkout();
        CouponResult coupon = evaluateCoupon(couponCode, subtotal);
        BigDecimal discount = coupon == null ? BigDecimal.ZERO : coupon.discount();

        BigDecimal delivery = subtotal.compareTo(cfg.freeDeliveryThreshold()) >= 0 ? BigDecimal.ZERO : cfg.baseDeliveryFee();
        if (distanceKm > cfg.farDistanceKm()) delivery = delivery.add(cfg.farDistanceSurcharge());
        BigDecimal handling = subtotal.signum() > 0 ? cfg.handlingFee() : BigDecimal.ZERO;

        BigDecimal total = subtotal.subtract(discount).add(delivery).add(handling).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal toFree = cfg.freeDeliveryThreshold().subtract(subtotal).max(BigDecimal.ZERO);
        return new Breakdown(scale(subtotal), scale(discount), scale(delivery), scale(handling), total, scale(toFree), coupon);
    }

    public CouponResult evaluateCoupon(String code, BigDecimal subtotal) {
        if (code == null || code.isBlank()) return null;
        String normalized = code.trim().toUpperCase();
        Coupon c = couponRepository.findByCodeIgnoreCase(normalized).orElse(null);
        if (c == null || !c.isActive()) return rejected(normalized, "This code isn't valid.");
        if (c.getExpiresAt() != null && c.getExpiresAt().isBefore(Instant.now())) return rejected(normalized, "This code has expired.");
        if (c.getUsageLimit() != null && c.getUsedCount() >= c.getUsageLimit()) return rejected(normalized, "This code has been fully claimed.");
        if (subtotal.compareTo(c.getMinCartValue()) < 0) {
            return rejected(normalized, "Add ₹" + c.getMinCartValue().subtract(subtotal).setScale(0, RoundingMode.UP)
                    + " more to use " + normalized + ".");
        }
        BigDecimal discount = c.getDiscountType() == DiscountType.PERCENTAGE
                ? subtotal.multiply(c.getDiscountValue()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : c.getDiscountValue();
        if (c.getMaxDiscount() != null) discount = discount.min(c.getMaxDiscount());
        discount = discount.min(subtotal);
        return new CouponResult(c.getCode(), true, c.getDescription(), scale(discount));
    }

    public List<Coupon> activeCoupons() {
        return couponRepository.findByActiveTrueOrderByMinCartValueAsc();
    }

    private static CouponResult rejected(String code, String message) {
        return new CouponResult(code, false, message, BigDecimal.ZERO);
    }

    private static BigDecimal scale(BigDecimal v) { return v.setScale(2, RoundingMode.HALF_UP); }
}
