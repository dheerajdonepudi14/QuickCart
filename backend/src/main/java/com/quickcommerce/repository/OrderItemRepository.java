package com.quickcommerce.repository;

import com.quickcommerce.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    /** "Frequently bought together": products co-occurring in the same basket, ranked by basket count. */
    @Query(value = """
            SELECT other.product_id
            FROM order_items base
            JOIN order_items other ON other.order_id = base.order_id AND other.product_id <> base.product_id
            JOIN orders o ON o.id = base.order_id
            WHERE base.product_id = :productId AND o.status NOT IN ('CREATED','PAYMENT_FAILED','EXPIRED')
            GROUP BY other.product_id
            ORDER BY COUNT(DISTINCT base.order_id) DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Long> findFrequentlyBoughtWith(@Param("productId") Long productId, @Param("limit") int limit);
}
