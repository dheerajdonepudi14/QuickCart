package com.quickcommerce.repository;

import com.quickcommerce.entity.StoreInventory;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface StoreInventoryRepository extends JpaRepository<StoreInventory, Long> {

    /**
     * SELECT ... FOR UPDATE on the (store, product) row. Two shoppers racing for the last
     * unit serialise here; the second one sees the decremented stock after the first commits.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000"))
    @Query("SELECT i FROM StoreInventory i JOIN FETCH i.product p WHERE i.darkStore.id = :storeId AND p.id = :productId")
    Optional<StoreInventory> findAndLockInventory(@Param("storeId") Long storeId, @Param("productId") Long productId);

    Optional<StoreInventory> findByDarkStoreIdAndProductId(Long storeId, Long productId);

    /** Shopper catalog. Empty-string parameters mean "no filter". */
    @Query(value = """
            SELECT i FROM StoreInventory i JOIN FETCH i.product p JOIN FETCH p.category c
            WHERE i.darkStore.id = :storeId AND p.active = true AND i.available = true
              AND (:categorySlug = '' OR c.slug = :categorySlug)
              AND (:pattern = '' OR LOWER(p.title) LIKE :pattern OR LOWER(p.brand) LIKE :pattern
                   OR LOWER(COALESCE(p.tags, '')) LIKE :pattern OR LOWER(c.name) LIKE :pattern)
            """,
            countQuery = """
            SELECT COUNT(i) FROM StoreInventory i JOIN i.product p JOIN p.category c
            WHERE i.darkStore.id = :storeId AND p.active = true AND i.available = true
              AND (:categorySlug = '' OR c.slug = :categorySlug)
              AND (:pattern = '' OR LOWER(p.title) LIKE :pattern OR LOWER(p.brand) LIKE :pattern
                   OR LOWER(COALESCE(p.tags, '')) LIKE :pattern OR LOWER(c.name) LIKE :pattern)
            """)
    Page<StoreInventory> searchCatalog(@Param("storeId") Long storeId,
                                       @Param("categorySlug") String categorySlug,
                                       @Param("pattern") String pattern,
                                       Pageable pageable);

    /** Biggest savings first, in stock only. */
    @Query("""
            SELECT i FROM StoreInventory i JOIN FETCH i.product p JOIN FETCH p.category c
            WHERE i.darkStore.id = :storeId AND p.active = true AND i.available = true AND i.stockQuantity > 0
            ORDER BY (p.basePrice - i.salePrice) / p.basePrice DESC, p.rating DESC
            """)
    List<StoreInventory> findTopSavers(@Param("storeId") Long storeId, Pageable pageable);

    @Query("""
            SELECT i FROM StoreInventory i JOIN FETCH i.product p JOIN FETCH p.category c
            WHERE i.darkStore.id = :storeId AND p.id IN :productIds
            """)
    List<StoreInventory> findForStoreAndProducts(@Param("storeId") Long storeId,
                                                 @Param("productIds") Collection<Long> productIds);

    /** Admin grid includes inactive products and unavailable rows. */
    @Query(value = """
            SELECT i FROM StoreInventory i JOIN FETCH i.product p JOIN FETCH p.category c
            WHERE i.darkStore.id = :storeId
              AND (:pattern = '' OR LOWER(p.title) LIKE :pattern OR LOWER(p.brand) LIKE :pattern)
              AND (:lowStockOnly = false OR i.stockQuantity < :threshold)
            """,
            countQuery = """
            SELECT COUNT(i) FROM StoreInventory i JOIN i.product p
            WHERE i.darkStore.id = :storeId
              AND (:pattern = '' OR LOWER(p.title) LIKE :pattern OR LOWER(p.brand) LIKE :pattern)
              AND (:lowStockOnly = false OR i.stockQuantity < :threshold)
            """)
    Page<StoreInventory> adminSearch(@Param("storeId") Long storeId,
                                     @Param("pattern") String pattern,
                                     @Param("lowStockOnly") boolean lowStockOnly,
                                     @Param("threshold") int threshold,
                                     Pageable pageable);

    @Query("SELECT COUNT(i) FROM StoreInventory i WHERE i.darkStore.id = :storeId AND i.stockQuantity < :threshold")
    long countLowStock(@Param("storeId") Long storeId, @Param("threshold") int threshold);

    @Query("SELECT COUNT(i) FROM StoreInventory i WHERE i.darkStore.id = :storeId AND i.stockQuantity = 0")
    long countOutOfStock(@Param("storeId") Long storeId);
}
