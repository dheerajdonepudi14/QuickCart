package com.quickcommerce.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "store_inventories",
        uniqueConstraints = @UniqueConstraint(name = "unique_store_product", columnNames = {"dark_store_id", "product_id"}))
@Getter @Setter @NoArgsConstructor
public class StoreInventory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "dark_store_id")
    private DarkStore darkStore;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(name = "stock_quantity", nullable = false)
    private int stockQuantity;

    @Column(name = "sale_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal salePrice;

    /** Units sold (reserved by non-cancelled orders) at this store. */
    @Column(name = "sold_count", nullable = false)
    private int soldCount;

    @Column(name = "is_available", nullable = false)
    private boolean available = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Version
    @Column(nullable = false)
    private long version;

    @PreUpdate
    void touch() { this.updatedAt = Instant.now(); }
}
