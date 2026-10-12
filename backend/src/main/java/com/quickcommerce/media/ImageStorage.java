package com.quickcommerce.media;

/** Object storage for product photos. Keys look like "products/42/3f9c1a2b.jpg" (content-hashed = cache-busting). */
public interface ImageStorage {

    /** Short provider id shown in the admin UI: local, supabase or s3. */
    String name();

    /** Stores the bytes (immutable, long-cache) and returns the object's own public URL. */
    String put(String key, byte[] data, String contentType);

    /** Deletes an object previously returned by {@link #put}; silently ignores foreign URLs. */
    void delete(String publicUrl);

    /** True when the URL points into this storage (used to clean up replaced images). */
    boolean owns(String publicUrl);

    /** Public URL prefix (before the key) — used to apply a CDN rewrite. */
    String publicPrefix();
}
