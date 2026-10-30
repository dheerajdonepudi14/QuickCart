package com.quickcommerce.service;

import com.quickcommerce.dto.StatsDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/** Read-only reporting queries (plain SQL keeps them fast and independent of the JPA model). */
@Service
@RequiredArgsConstructor
public class StatsService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private final JdbcTemplate jdbc;

    private long count(String sql, Object... args) {
        Long v = jdbc.queryForObject(sql, Long.class, args);
        return v == null ? 0 : v;
    }

    @Transactional(readOnly = true)
    public PlatformStats platform() {
        Timestamp now = Timestamp.from(Instant.now());
        Timestamp today = Timestamp.from(LocalDate.now(IST).atStartOfDay(IST).toInstant());
        return new PlatformStats(
                count("SELECT COUNT(*) FROM users WHERE role = 'ROLE_CUSTOMER'"),
                count("SELECT COUNT(DISTINCT user_id) FROM refresh_tokens WHERE revoked = FALSE AND expires_at > ?", now),
                count("SELECT COUNT(*) FROM users WHERE last_login_at >= ?", today),
                count("SELECT COUNT(*) FROM users WHERE role = 'ROLE_CUSTOMER' AND created_at >= ?", today),
                count("SELECT COUNT(*) FROM products WHERE is_active = TRUE"),
                count("SELECT COUNT(*) FROM categories"),
                count("SELECT COUNT(*) FROM dark_stores WHERE is_active = TRUE"),
                count("SELECT COALESCE(SUM(sold_count), 0) FROM store_inventories"),
                count("SELECT COALESCE(SUM(stock_quantity), 0) FROM store_inventories WHERE is_available = TRUE"),
                count("SELECT COUNT(*) FROM store_inventories WHERE stock_quantity = 0 OR is_available = FALSE"),
                count("SELECT COUNT(*) FROM orders WHERE status NOT IN ('CREATED','PAYMENT_FAILED','EXPIRED')"),
                count("SELECT COUNT(*) FROM orders WHERE status = 'DELIVERED'"),
                Instant.now());
    }

    @Transactional(readOnly = true)
    public PageOf<AdminUserRow> users(String q, String filter, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        String like = q == null || q.isBlank() ? "%" : "%" + q.trim().toLowerCase() + "%";
        Timestamp now = Timestamp.from(Instant.now());
        String where = " WHERE (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR COALESCE(u.phone_number,'') LIKE ?)";
        if ("loggedIn".equals(filter)) {
            where += " AND EXISTS (SELECT 1 FROM refresh_tokens rt WHERE rt.user_id = u.id AND rt.revoked = FALSE AND rt.expires_at > ?)";
        } else if ("customers".equals(filter)) {
            where += " AND u.role = 'ROLE_CUSTOMER'";
        }
        Object[] args = "loggedIn".equals(filter) ? new Object[]{like, like, like, now} : new Object[]{like, like, like};

        long total = count("SELECT COUNT(*) FROM users u" + where, args);
        String sql = """
                SELECT u.id, u.full_name, u.email, u.phone_number, u.role, u.provider, u.created_at, u.last_login_at, u.login_count,
                       EXISTS (SELECT 1 FROM refresh_tokens rt WHERE rt.user_id = u.id AND rt.revoked = FALSE AND rt.expires_at > ?) AS logged_in,
                       (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status NOT IN ('CREATED','PAYMENT_FAILED','EXPIRED')) AS orders,
                       (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.user_id = u.id AND o.status NOT IN ('CREATED','PAYMENT_FAILED','EXPIRED','CANCELLED')) AS spent
                FROM users u""" + where + " ORDER BY u.last_login_at DESC NULLS LAST, u.id DESC LIMIT ? OFFSET ?";

        Object[] full = new Object[args.length + 3];
        full[0] = now;
        System.arraycopy(args, 0, full, 1, args.length);
        full[args.length + 1] = safeSize;
        full[args.length + 2] = safePage * safeSize;

        List<AdminUserRow> rows = jdbc.query(sql, (rs, i) -> new AdminUserRow(
                rs.getLong("id"), rs.getString("full_name"), rs.getString("email"), rs.getString("phone_number"),
                rs.getString("role"), rs.getString("provider"), instant(rs, "created_at"), instant(rs, "last_login_at"),
                rs.getInt("login_count"), rs.getBoolean("logged_in"), rs.getLong("orders"), bigDecimal(rs, "spent")), full);
        int pages = (int) Math.ceil(total / (double) safeSize);
        return new PageOf<>(rows, safePage, safeSize, total, pages, safePage + 1 >= pages);
    }

    @Transactional(readOnly = true)
    public PageOf<ProductImageRow> products(String q, boolean missingOnly, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 200);
        int safePage = Math.max(page, 0);
        String like = q == null || q.isBlank() ? "%" : "%" + q.trim().toLowerCase() + "%";
        String where = " WHERE (LOWER(p.title) LIKE ? OR LOWER(p.brand) LIKE ? OR LOWER(c.name) LIKE ?)";
        if (missingOnly) where += " AND NOT (p.image_url LIKE 'http%' OR p.image_url LIKE '/%')";

        long total = count("SELECT COUNT(*) FROM products p JOIN categories c ON c.id = p.category_id" + where, like, like, like);
        String sql = """
                SELECT p.id, p.title, p.brand, c.name AS category_name, c.slug AS category_slug, p.unit_quantity, p.image_url,
                       p.image_alt, p.image_url_b, p.image_width, p.image_height,
                       COALESCE(ea.impressions, 0) AS imp_a, COALESCE(ea.add_to_carts, 0) AS atc_a,
                       COALESCE(eb.impressions, 0) AS imp_b, COALESCE(eb.add_to_carts, 0) AS atc_b,
                       COALESCE((SELECT SUM(si.sold_count) FROM store_inventories si WHERE si.product_id = p.id), 0) AS sold,
                       COALESCE((SELECT SUM(si.stock_quantity) FROM store_inventories si WHERE si.product_id = p.id AND si.is_available = TRUE), 0) AS stock
                FROM products p JOIN categories c ON c.id = p.category_id
                LEFT JOIN image_experiment_stats ea ON ea.product_id = p.id AND ea.variant = 'A'
                LEFT JOIN image_experiment_stats eb ON eb.product_id = p.id AND eb.variant = 'B'""" + where + " ORDER BY c.sort_order, p.id LIMIT ? OFFSET ?";
        List<ProductImageRow> rows = jdbc.query(sql, (rs, i) -> {
            String img = rs.getString("image_url");
            return new ProductImageRow(rs.getLong("id"), rs.getString("title"), rs.getString("brand"),
                    rs.getString("category_name"), rs.getString("category_slug"), rs.getString("unit_quantity"), img,
                    ProductImageService.isRealImage(img), rs.getLong("sold"), rs.getLong("stock"),
                    rs.getString("image_alt"), rs.getString("image_url_b"),
                    (Integer) rs.getObject("image_width"), (Integer) rs.getObject("image_height"),
                    rs.getLong("imp_a"), rs.getLong("atc_a"), rs.getLong("imp_b"), rs.getLong("atc_b"));
        }, like, like, like, safeSize, safePage * safeSize);
        int pages = (int) Math.ceil(total / (double) safeSize);
        return new PageOf<>(rows, safePage, safeSize, total, pages, safePage + 1 >= pages);
    }

    private static Instant instant(ResultSet rs, String col) throws SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }

    private static BigDecimal bigDecimal(ResultSet rs, String col) throws SQLException {
        BigDecimal b = rs.getBigDecimal(col);
        return b == null ? BigDecimal.ZERO : b;
    }
}
