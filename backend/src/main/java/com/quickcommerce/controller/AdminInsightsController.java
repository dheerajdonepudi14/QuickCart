package com.quickcommerce.controller;

import com.quickcommerce.dto.StatsDtos.*;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.security.CurrentUser;
import com.quickcommerce.security.UserPrincipal;
import com.quickcommerce.service.ProductImageService;
import com.quickcommerce.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/** Platform-wide admin views: registered / logged-in users and the product image manager. */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminInsightsController {

    private final StatsService statsService;
    private final ProductImageService imageService;

    /** Store managers (admins bound to one store) can't browse the global customer list or edit the catalog. */
    private static void requirePlatformAdmin() {
        UserPrincipal p = CurrentUser.require();
        if (p.storeId() != null) throw ApiException.forbidden("Only platform admins can do this.");
    }

    @GetMapping("/users")
    public PageOf<AdminUserRow> users(@RequestParam(required = false) String q,
                                      @RequestParam(defaultValue = "all") String filter,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "25") int size) {
        requirePlatformAdmin();
        return statsService.users(q, filter, page, size);
    }

    @GetMapping("/products")
    public PageOf<ProductImageRow> products(@RequestParam(required = false) String q,
                                            @RequestParam(defaultValue = "false") boolean missingImage,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "48") int size) {
        requirePlatformAdmin();
        return statsService.products(q, missingImage, page, size);
    }

    @PatchMapping("/products/{productId}/image")
    public Map<String, String> setImage(@PathVariable Long productId, @RequestBody ImageUpdateRequest req) {
        requirePlatformAdmin();
        if (req.alt() != null && req.imageUrl() == null) {
            return Map.of("imageAlt", imageService.setAlt(productId, req.alt()));
        }
        if (req.alt() != null) imageService.setAlt(productId, req.alt());
        return Map.of("imageUrl", imageService.setUrl(productId, req.imageUrl(), req.variant()));
    }

    public record BulkImageItem(Long productId, String imageUrl) {}
    public record BulkImageRequest(java.util.List<BulkImageItem> items) {}

    /** Saves many matches at once (used by the "auto-match images" tool). */
    @PatchMapping("/products/images")
    public Map<String, Integer> setImages(@RequestBody BulkImageRequest req) {
        requirePlatformAdmin();
        if (req.items() == null || req.items().size() > 500) throw ApiException.badRequest("Send between 1 and 500 images.");
        int saved = 0;
        for (BulkImageItem item : req.items()) {
            if (item.productId() == null) continue;
            try {
                imageService.setUrl(item.productId(), item.imageUrl(), "A");
                saved++;
            } catch (ApiException ignored) {
                // skip invalid entries, keep the rest
            }
        }
        return Map.of("saved", saved);
    }

    @PostMapping(value = "/products/{productId}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadImage(@PathVariable Long productId, @RequestParam("file") MultipartFile file,
                                           @RequestParam(value = "variant", defaultValue = "A") String variant) {
        requirePlatformAdmin();
        return Map.of("imageUrl", imageService.upload(productId, file, variant));
    }

    /** Promote the A/B test's variant B to the main photo. */
    @PostMapping("/products/{productId}/image/promote")
    public Map<String, String> promote(@PathVariable Long productId) {
        requirePlatformAdmin();
        return Map.of("imageUrl", imageService.promoteVariantB(productId));
    }

    @GetMapping("/storage")
    public Map<String, String> storage() {
        requirePlatformAdmin();
        return Map.of("provider", imageService.storageName());
    }
}
