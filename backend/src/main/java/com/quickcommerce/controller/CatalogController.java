package com.quickcommerce.controller;

import com.quickcommerce.dto.CatalogDtos.*;
import com.quickcommerce.service.CatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/v1/catalog")
@RequiredArgsConstructor
public class CatalogController {

    private final CatalogService catalogService;

    @GetMapping("/categories")
    public ResponseEntity<List<CategoryResponse>> categories() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic())
                .body(catalogService.categories());
    }

    @GetMapping("/stores/{storeId}/products")
    public PageResponse<ProductCardResponse> products(@PathVariable Long storeId,
                                                      @RequestParam(required = false) String category,
                                                      @RequestParam(required = false) String q,
                                                      @RequestParam(defaultValue = "relevance") String sort,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "24") int size) {
        return catalogService.products(storeId, category, q, sort, page, size);
    }

    @GetMapping("/stores/{storeId}/top-savers")
    public List<ProductCardResponse> topSavers(@PathVariable Long storeId, @RequestParam(defaultValue = "12") int limit) {
        return catalogService.topSavers(storeId, limit);
    }

    @GetMapping("/stores/{storeId}/suggest")
    public List<SuggestionResponse> suggest(@PathVariable Long storeId, @RequestParam String q) {
        return catalogService.suggest(storeId, q);
    }

    @GetMapping("/stores/{storeId}/products/{productId}")
    public ProductDetailResponse product(@PathVariable Long storeId, @PathVariable Long productId) {
        return catalogService.product(storeId, productId);
    }
}
