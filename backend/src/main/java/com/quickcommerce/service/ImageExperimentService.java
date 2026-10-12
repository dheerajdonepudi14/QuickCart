package com.quickcommerce.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Image A/B testing: the storefront assigns each visitor a stable variant and reports impressions and
 * add-to-carts per product; the admin compares conversion and promotes the winner.
 */
@Service
@RequiredArgsConstructor
public class ImageExperimentService {

    public record ImageEvent(Long productId, String variant, String type) {}

    private final JdbcTemplate jdbc;

    @Transactional
    public int record(List<ImageEvent> events) {
        int n = 0;
        for (ImageEvent e : events) {
            if (e == null || e.productId() == null || e.variant() == null || e.type() == null) continue;
            String variant = e.variant().toUpperCase();
            if (!variant.equals("A") && !variant.equals("B")) continue;
            String column = switch (e.type()) {
                case "impression" -> "impressions";
                case "add_to_cart" -> "add_to_carts";
                default -> null;
            };
            if (column == null) continue;
            n += jdbc.update("INSERT INTO image_experiment_stats (product_id, variant, " + column + ") "
                            + "SELECT ?, ?, 1 WHERE EXISTS (SELECT 1 FROM products WHERE id = ? AND image_url_b IS NOT NULL) "
                            + "ON CONFLICT (product_id, variant) DO UPDATE SET " + column + " = image_experiment_stats." + column + " + 1",
                    e.productId(), variant, e.productId());
        }
        return n;
    }
}
