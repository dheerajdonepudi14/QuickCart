package com.quickcommerce.media;

import com.quickcommerce.config.StorageProperties;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.integration.ExternalHttp;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;

import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

/**
 * Supabase Storage (public bucket, served through Supabase's CDN).
 * Upload: POST {url}/storage/v1/object/{bucket}/{key} with the service-role key (never sent to browsers).
 * Public URL: {url}/storage/v1/object/public/{bucket}/{key}.
 */
@Slf4j
public class SupabaseImageStorage implements ImageStorage {

    private final StorageProperties.Supabase cfg;
    private final ExternalHttp http;
    private final String base;

    public SupabaseImageStorage(StorageProperties.Supabase cfg, ExternalHttp http) {
        this.cfg = cfg;
        this.http = http;
        this.base = cfg.url().replaceAll("/+$", "");
    }

    @Override public String name() { return "supabase"; }

    @Override public String publicPrefix() { return base + "/storage/v1/object/public/" + cfg.bucketName() + "/"; }

    @Override
    public String put(String key, byte[] data, String contentType) {
        HttpRequest req = ExternalHttp.request(base + "/storage/v1/object/" + cfg.bucketName() + "/" + key, 30)
                .header("Authorization", "Bearer " + cfg.serviceRoleKey())
                .header("apikey", cfg.serviceRoleKey())
                .header("Content-Type", contentType)
                .header("Cache-Control", "max-age=31536000")
                .header("x-upsert", "true")
                .POST(HttpRequest.BodyPublishers.ofByteArray(data)).build();
        HttpResponse<String> res;
        try {
            res = http.send("supabase_storage", "upload", req, true);
        } catch (ExternalHttp.ExternalCallException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Image storage is unreachable. Try again.");
        }
        if (res.statusCode() >= 400) {
            log.warn("Supabase upload failed {}: {}", res.statusCode(), res.body());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Image storage rejected the upload (" + res.statusCode()
                    + "). Check SUPABASE_SERVICE_ROLE_KEY and that the '" + cfg.bucketName() + "' bucket exists.");
        }
        return publicPrefix() + key;
    }

    @Override
    public boolean owns(String url) { return url != null && url.startsWith(publicPrefix()); }

    @Override
    public void delete(String url) {
        if (!owns(url)) return;
        String key = url.substring(publicPrefix().length());
        HttpRequest req = ExternalHttp.request(base + "/storage/v1/object/" + cfg.bucketName() + "/" + key, 15)
                .header("Authorization", "Bearer " + cfg.serviceRoleKey())
                .header("apikey", cfg.serviceRoleKey())
                .DELETE().build();
        try {
            http.send("supabase_storage", "delete", req, true);
        } catch (RuntimeException e) {
            log.debug("Old image not removed from Supabase: {}", e.getMessage());
        }
    }
}
