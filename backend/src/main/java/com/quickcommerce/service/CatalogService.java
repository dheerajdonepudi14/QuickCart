package com.quickcommerce.service;

import com.quickcommerce.config.AppProperties;
import com.quickcommerce.dto.CatalogDtos.*;
import com.quickcommerce.entity.Category;
import com.quickcommerce.entity.Product;
import com.quickcommerce.entity.StoreInventory;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.repository.CategoryRepository;
import com.quickcommerce.repository.OrderItemRepository;
import com.quickcommerce.repository.StoreInventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatalogService {

    private final CategoryRepository categoryRepository;
    private final StoreInventoryRepository inventoryRepository;
    private final OrderItemRepository orderItemRepository;
    private final StoreService storeService;
    private final AppProperties props;

    @Cacheable("categories")
    public List<CategoryResponse> categories() {
        return categoryRepository.findAllByOrderBySortOrderAsc().stream().map(CatalogService::toCategory).toList();
    }

    public PageResponse<ProductCardResponse> products(Long storeId, String categorySlug, String q, String sort, int page, int size) {
        storeService.require(storeId);
        int safeSize = Math.min(Math.max(size, 1), 60);
        String slug = categorySlug == null ? "" : categorySlug.trim();
        String pattern = likePattern(q);

        if ("discount".equals(sort) && slug.isEmpty() && pattern.isEmpty()) {
            List<ProductCardResponse> list = inventoryRepository.findTopSavers(storeId, PageRequest.of(page, safeSize))
                    .stream().map(this::toCard).toList();
            return new PageResponse<>(list, page, safeSize, list.size(), 1, true);
        }
        Page<StoreInventory> result = inventoryRepository.searchCatalog(storeId, slug, pattern,
                PageRequest.of(Math.max(page, 0), safeSize, sortFor(sort)));
        return new PageResponse<>(result.getContent().stream().map(this::toCard).toList(), result.getNumber(),
                result.getSize(), result.getTotalElements(), result.getTotalPages(), result.isLast());
    }

    public List<ProductCardResponse> topSavers(Long storeId, int limit) {
        storeService.require(storeId);
        return inventoryRepository.findTopSavers(storeId, PageRequest.of(0, Math.min(limit, 24)))
                .stream().map(this::toCard).toList();
    }

    public List<SuggestionResponse> suggest(Long storeId, String q) {
        String pattern = likePattern(q);
        if (pattern.isEmpty() || q.trim().length() < 2) return List.of();
        return inventoryRepository.searchCatalog(storeId, "", pattern, PageRequest.of(0, 8, Sort.by(Sort.Direction.DESC, "product.rating")))
                .getContent().stream()
                .map(i -> new SuggestionResponse(i.getProduct().getId(), i.getProduct().getTitle(), i.getProduct().getBrand(),
                        i.getProduct().getImageUrl(), i.getProduct().getCategory().getName(), i.getSalePrice()))
                .toList();
    }

    public ProductDetailResponse product(Long storeId, Long productId) {
        StoreInventory inv = inventoryRepository.findForStoreAndProducts(storeId, List.of(productId)).stream().findFirst()
                .filter(i -> i.getProduct().isActive())
                .orElseThrow(() -> ApiException.notFound("This product isn't sold at your store."));
        Product p = inv.getProduct();

        // Recommendation: co-purchase signal first, then top-rated items from the same aisle.
        List<Long> coIds = orderItemRepository.findFrequentlyBoughtWith(productId, 8);
        List<ProductCardResponse> together = coIds.isEmpty() ? List.of()
                : inventoryRepository.findForStoreAndProducts(storeId, coIds).stream()
                .filter(i -> i.isAvailable() && i.getStockQuantity() > 0 && i.getProduct().isActive())
                .sorted(Comparator.comparingInt(i -> coIds.indexOf(i.getProduct().getId())))
                .map(this::toCard).toList();

        List<ProductCardResponse> similar = inventoryRepository.searchCatalog(storeId, p.getCategory().getSlug(), "",
                        PageRequest.of(0, 12, Sort.by(Sort.Direction.DESC, "product.rating"))).getContent().stream()
                .filter(i -> !i.getProduct().getId().equals(productId))
                .limit(10).map(this::toCard).toList();

        return new ProductDetailResponse(toCard(inv), p.getDescription(), p.getAttributes(), together, similar);
    }

    public ProductCardResponse toCard(StoreInventory i) {
        Product p = i.getProduct();
        int threshold = props.checkout().lowStockThreshold();
        int stock = i.isAvailable() ? i.getStockQuantity() : 0;
        String status = stock <= 0 ? "OUT_OF_STOCK" : stock < threshold ? "LOW_STOCK" : "IN_STOCK";
        int discount = discountPercent(p.getBasePrice(), i.getSalePrice());

        List<String> badges = new ArrayList<>();
        if (stock > 0) badges.add("10 MINS");
        if (stock <= 0) badges.add("Out of Stock");
        else if (stock < threshold) badges.add("Only " + stock + " left");
        return new ProductCardResponse(p.getId(), p.getTitle(), p.getBrand(), p.getUnitQuantity(), p.getBasePrice(),
                i.getSalePrice(), discount, p.getImageUrl(), p.getRating().doubleValue(), p.getCategory().getSlug(),
                p.getCategory().getName(), Math.max(stock, 0), status, badges, i.getSoldCount(),
                p.getImageAlt() != null ? p.getImageAlt() : p.getTitle(), p.getImageUrlB());
    }

    public static int discountPercent(BigDecimal mrp, BigDecimal sale) {
        if (mrp == null || mrp.signum() == 0 || sale.compareTo(mrp) >= 0) return 0;
        return mrp.subtract(sale).multiply(BigDecimal.valueOf(100)).divide(mrp, 0, RoundingMode.HALF_UP).intValue();
    }

    public static CategoryResponse toCategory(Category c) {
        return new CategoryResponse(c.getId(), c.getName(), c.getSlug(), c.getImageUrl(), c.getDepartment(), c.getThemeColor());
    }

    private static Sort sortFor(String sort) {
        return switch (sort == null ? "" : sort) {
            case "price_asc" -> Sort.by(Sort.Direction.ASC, "salePrice");
            case "price_desc" -> Sort.by(Sort.Direction.DESC, "salePrice");
            case "newest" -> Sort.by(Sort.Direction.DESC, "product.createdAt");
            case "name" -> Sort.by(Sort.Direction.ASC, "product.title");
            default -> Sort.by(Sort.Direction.DESC, "product.rating").and(Sort.by("id"));
        };
    }

    static String likePattern(String q) {
        if (q == null || q.isBlank()) return "";
        String cleaned = q.trim().toLowerCase(Locale.ROOT).replace("\\", "").replace("%", "").replace("_", " ");
        return "%" + cleaned + "%";
    }
}
