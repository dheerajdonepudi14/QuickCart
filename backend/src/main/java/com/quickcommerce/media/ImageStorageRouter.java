package com.quickcommerce.media;

import com.quickcommerce.config.StorageProperties;
import com.quickcommerce.integration.ExternalHttp;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Picks the active image storage from app.storage.provider (auto | local | supabase | s3) and applies the
 * optional CDN rewrite. Other configured stores are kept so replaced images can be cleaned up anywhere.
 */
@Slf4j
@Component
public class ImageStorageRouter {

    private final StorageProperties props;
    private final ImageStorage active;
    private final List<ImageStorage> all = new ArrayList<>();

    public ImageStorageRouter(StorageProperties props, ExternalHttp http) {
        this.props = props;
        ImageStorage local = new LocalImageStorage(props);
        ImageStorage supabase = props.supabase().enabled() ? new SupabaseImageStorage(props.supabase(), http) : null;
        ImageStorage s3 = props.s3().enabled() ? new S3ImageStorage(props.s3()) : null;
        all.add(local);
        if (supabase != null) all.add(supabase);
        if (s3 != null) all.add(s3);
        this.active = switch (props.mode()) {
            case "supabase" -> require(supabase, "supabase", local);
            case "s3" -> require(s3, "s3", local);
            case "local" -> local;
            default -> supabase != null ? supabase : s3 != null ? s3 : local;
        };
        log.info("Product image storage: {}{}", active.name(), props.hasCdn() ? " via CDN " + props.cdnBaseUrl() : "");
    }

    private static ImageStorage require(ImageStorage chosen, String name, ImageStorage fallback) {
        if (chosen != null) return chosen;
        log.warn("STORAGE_PROVIDER={} but its credentials are missing — falling back to local storage", name);
        return fallback;
    }

    public ImageStorage active() { return active; }

    /** Stores and returns the URL shoppers will load (CDN URL when configured). */
    public String put(String key, byte[] data, String contentType) {
        String url = active.put(key, data, contentType);
        return props.hasCdn() ? props.cdnBaseUrl().replaceAll("/+$", "") + "/" + key : url;
    }

    public void delete(String url) {
        if (url == null) return;
        String resolved = url;
        if (props.hasCdn()) {
            String cdn = props.cdnBaseUrl().replaceAll("/+$", "") + "/";
            if (url.startsWith(cdn)) resolved = active.publicPrefix() + url.substring(cdn.length());
        }
        for (ImageStorage s : all) {
            if (s.owns(resolved)) {
                s.delete(resolved);
                return;
            }
        }
    }

    public String describe() {
        return active.name() + (props.hasCdn() ? " + CDN" : "");
    }
}
