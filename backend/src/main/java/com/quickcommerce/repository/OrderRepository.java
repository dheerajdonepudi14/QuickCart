package com.quickcommerce.repository;

import com.quickcommerce.entity.Order;
import com.quickcommerce.entity.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @EntityGraph(attributePaths = {"items", "darkStore", "deliveryAgent", "user"})
    @Query("SELECT o FROM Order o WHERE o.id = :id")
    Optional<Order> findDetailedById(@Param("id") Long id);

    /** [ownerId, storeId, agentId] for access checks without loading the aggregate. */
    @Query("SELECT o.user.id, o.darkStore.id, a.id FROM Order o LEFT JOIN o.deliveryAgent a WHERE o.id = :id")
    List<Object[]> findAccessTuple(@Param("id") Long id);

    Optional<Order> findByStripePaymentIntentId(String paymentIntentId);

    @EntityGraph(attributePaths = {"darkStore"})
    Page<Order> findByUserIdAndStatusNotOrderByCreatedAtDesc(Long userId, OrderStatus excluded, Pageable pageable);

    @Query("SELECT o.id FROM Order o WHERE o.status = :status AND o.reservationExpiresAt < :now")
    List<Long> findExpiredReservationIds(@Param("status") OrderStatus status, @Param("now") Instant now);

    @Query("SELECT o.id FROM Order o WHERE o.status = :status AND o.updatedAt < :before")
    List<Long> findIdsByStatusUpdatedBefore(@Param("status") OrderStatus status, @Param("before") Instant before);

    @Query("SELECT o.id FROM Order o WHERE o.status = :status")
    List<Long> findIdsByStatus(@Param("status") OrderStatus status);

    @EntityGraph(attributePaths = {"items", "user", "deliveryAgent", "darkStore"})
    @Query("""
            SELECT o FROM Order o
            WHERE (:storeId IS NULL OR o.darkStore.id = :storeId) AND o.status IN :statuses
            ORDER BY o.createdAt DESC
            """)
    List<Order> findForControlTower(@Param("storeId") Long storeId,
                                    @Param("statuses") Collection<OrderStatus> statuses,
                                    Pageable pageable);

    @EntityGraph(attributePaths = {"items", "user", "deliveryAgent", "darkStore"})
    @Query("SELECT o FROM Order o WHERE o.deliveryAgent.id = :agentId AND o.status IN :statuses ORDER BY o.createdAt DESC")
    List<Order> findForAgent(@Param("agentId") Long agentId, @Param("statuses") Collection<OrderStatus> statuses);

    // ---------- analytics (native, PostgreSQL) ----------

    @Query(value = """
            SELECT to_char(date_trunc(:bucket, o.created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS period,
                   COALESCE(SUM(o.total_amount), 0) AS revenue,
                   COUNT(*) AS orders
            FROM orders o
            WHERE o.dark_store_id = :storeId
              AND o.status IN ('ORDER_PLACED','PACKING_IN_PROGRESS','OUT_FOR_DELIVERY','DELIVERED')
              AND o.created_at >= :since
            GROUP BY 1 ORDER BY 1
            """, nativeQuery = true)
    List<Object[]> revenueSeries(@Param("storeId") Long storeId, @Param("bucket") String bucket, @Param("since") Instant since);

    @Query(value = """
            SELECT p.id, p.title, p.image_url, SUM(oi.quantity) AS units, SUM(oi.total_price) AS revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.id = oi.product_id
            WHERE o.dark_store_id = :storeId
              AND o.status IN ('ORDER_PLACED','PACKING_IN_PROGRESS','OUT_FOR_DELIVERY','DELIVERED')
              AND o.created_at >= :since
            GROUP BY p.id, p.title, p.image_url
            ORDER BY units DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Object[]> topSellingSkus(@Param("storeId") Long storeId, @Param("since") Instant since, @Param("limit") int limit);

    @Query(value = """
            SELECT COALESCE(SUM(total_amount), 0), COUNT(*), COALESCE(AVG(total_amount), 0)
            FROM orders
            WHERE dark_store_id = :storeId
              AND status IN ('ORDER_PLACED','PACKING_IN_PROGRESS','OUT_FOR_DELIVERY','DELIVERED')
              AND created_at >= :since
            """, nativeQuery = true)
    List<Object[]> kpis(@Param("storeId") Long storeId, @Param("since") Instant since);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.darkStore.id = :storeId AND o.status IN :statuses")
    long countByStoreAndStatuses(@Param("storeId") Long storeId, @Param("statuses") Collection<OrderStatus> statuses);
}
