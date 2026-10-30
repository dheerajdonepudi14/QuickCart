package com.quickcommerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Where product photos live. provider = auto | local | supabase | s3.
 * "auto" picks Supabase when its service key is present, then S3, then the local uploads folder.
 * cdnBaseUrl (optional) rewrites public URLs to a CDN such as CloudFront or Cloudflare.
 */
@ConfigurationProperties(prefix = "app.storage")
public record StorageProperties(String provider, String cdnBaseUrl, Integer maxDimension, Float jpegQuality,
                                String localDir, Supabase supabase, S3 s3) {

    private static boolean has(String v) { return v != null && !v.isBlank(); }

    public record Supabase(String url, String serviceRoleKey, String bucket) {
        public boolean enabled() { return has(url) && has(serviceRoleKey); }
        public String bucketName() { return has(bucket) ? bucket : "product-images"; }
    }

    public record S3(String endpoint, String region, String bucket, String accessKey, String secretKey,
                     String publicBaseUrl, Boolean pathStyle) {
        public boolean enabled() { return has(bucket) && has(accessKey) && has(secretKey); }
        public String regionOrDefault() { return has(region) ? region : "ap-south-1"; }
        public boolean pathStyleAccess() { return pathStyle != null ? pathStyle : has(endpoint); }
    }

    public String mode() { return has(provider) ? provider.trim().toLowerCase() : "auto"; }
    public int maxDim() { return maxDimension == null ? 1600 : maxDimension; }
    public float quality() { return jpegQuality == null ? 0.82f : jpegQuality; }
    public String localDirectory() { return has(localDir) ? localDir : "uploads"; }
    public boolean hasCdn() { return has(cdnBaseUrl); }
    public Supabase supabase() { return supabase != null ? supabase : new Supabase(null, null, null); }
    public S3 s3() { return s3 != null ? s3 : new S3(null, null, null, null, null, null, null); }
}
