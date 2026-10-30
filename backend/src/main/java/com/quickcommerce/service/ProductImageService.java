package com.quickcommerce.service;

import com.quickcommerce.config.StorageProperties;
import com.quickcommerce.entity.Product;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.media.ImageProcessor;
import com.quickcommerce.media.ImageStorageRouter;
import com.quickcommerce.payment.Crypto;
import com.quickcommerce.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.Base64;
import java.util.Set;

/**
 * Product photo pipeline: upload → validate → resize/re-encode (EXIF stripped) → content-hashed key in object
 * storage (Supabase / S3 / local) → optional CDN URL → product.image_url. Supports alt text and an A/B variant.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductImageService {

    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED = Set.of("image/jpeg", "image/png", "image/webp", "image/gif", "image/avif");

    private final ProductRepository productRepository;
    private final ImageStorageRouter storage;
    private final ImageProcessor processor;
    private final StorageProperties props;
    private final JdbcTemplate jdbc;

    public static boolean isRealImage(String url) {
        return url != null && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/"));
    }

    public String storageName() { return storage.describe(); }

    /** Sets an external https URL (or an emoji placeholder) for variant A or B. */
    @Transactional
    public String setUrl(Long productId, String url, String variant) {
        String value = url == null ? "" : url.trim();
        boolean b = "B".equalsIgnoreCase(variant);
        if (value.isEmpty()) {
            if (b) { // clearing variant B ends the experiment
                Product p = require(productId);
                storage.delete(p.getImageUrlB());
                p.setImageUrlB(null);
                resetExperiment(productId);
                return "";
            }
            throw ApiException.badRequest("Provide an image URL.");
        }
        boolean emoji = value.codePointCount(0, value.length()) <= 4 && !value.contains("/");
        if (!emoji && !value.startsWith("https://") && !value.startsWith("http://") && !value.startsWith("/uploads/")) {
            throw ApiException.badRequest("Image must be an http(s) URL, an uploaded /uploads/… path or an emoji placeholder.");
        }
        if (emoji && b) throw ApiException.badRequest("Variant B must be a real photo.");
        if (value.length() > 2000) throw ApiException.badRequest("That URL is too long.");
        Product p = require(productId);
        if (b) {
            String old = p.getImageUrlB();
            p.setImageUrlB(value);
            if (old != null && !old.equals(value)) storage.delete(old);
            resetExperiment(productId);
        } else {
            String old = p.getImageUrl();
            p.setImageUrl(value);
            p.setImageWidth(null);
            p.setImageHeight(null);
            p.setImageUpdatedAt(Instant.now());
            if (old != null && !old.equals(value)) storage.delete(old);
        }
        return value;
    }

    @Transactional
    public String upload(Long productId, MultipartFile file, String variant) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("Choose an image file.");
        if (file.getSize() > MAX_BYTES) throw ApiException.badRequest("Images must be 5 MB or smaller.");
        String type = String.valueOf(file.getContentType()).toLowerCase();
        if (!ALLOWED.contains(type)) throw ApiException.badRequest("Upload a JPG, PNG, WEBP, AVIF or GIF image.");
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("Could not read the uploaded file.");
        }
        Product p = require(productId);
        ImageProcessor.Processed img = processor.process(bytes, type, props.maxDim(), props.quality());
        String hash = Crypto.sha256Hex(Base64.getEncoder().encodeToString(img.bytes())).substring(0, 12);
        String key = "products/" + productId + "/" + hash + "." + img.extension();
        String url = storage.put(key, img.bytes(), img.contentType());
        boolean b = "B".equalsIgnoreCase(variant);
        if (b) {
            String old = p.getImageUrlB();
            p.setImageUrlB(url);
            if (old != null && !old.equals(url)) storage.delete(old);
            resetExperiment(productId);
        } else {
            String old = p.getImageUrl();
            p.setImageUrl(url);
            p.setImageWidth(img.width());
            p.setImageHeight(img.height());
            p.setImageUpdatedAt(Instant.now());
            if (old != null && !old.equals(url)) storage.delete(old);
        }
        log.info("Stored {} ({} bytes, {}x{}) for product {} via {}", key, img.bytes().length, img.width(), img.height(),
                productId, storage.describe());
        return url;
    }

    @Transactional
    public String setAlt(Long productId, String alt) {
        String v = alt == null ? "" : alt.trim();
        if (v.isEmpty() || v.length() > 250) throw ApiException.badRequest("Alt text must be 1–250 characters.");
        require(productId).setImageAlt(v);
        return v;
    }

    /** Makes variant B the main photo (the A/B winner) and ends the experiment. */
    @Transactional
    public String promoteVariantB(Long productId) {
        Product p = require(productId);
        if (p.getImageUrlB() == null) throw ApiException.badRequest("This product has no variant B.");
        String old = p.getImageUrl();
        p.setImageUrl(p.getImageUrlB());
        p.setImageUrlB(null);
        p.setImageWidth(null);
        p.setImageHeight(null);
        p.setImageUpdatedAt(Instant.now());
        storage.delete(old);
        resetExperiment(productId);
        return p.getImageUrl();
    }

    private void resetExperiment(Long productId) {
        jdbc.update("DELETE FROM image_experiment_stats WHERE product_id = ?", productId);
    }

    private Product require(Long id) {
        return productRepository.findById(id).orElseThrow(() -> ApiException.notFound("Product not found."));
    }
}
