package com.quickcommerce.media;

import com.quickcommerce.config.StorageProperties;
import com.quickcommerce.exception.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URI;

/**
 * Any S3-compatible bucket: AWS S3 (+ CloudFront), Cloudflare R2, MinIO or Supabase's S3 endpoint.
 * Objects are written with a one-year immutable Cache-Control so the CDN can cache them at the edge.
 */
@Slf4j
public class S3ImageStorage implements ImageStorage {

    private final StorageProperties.S3 cfg;
    private final S3Client client;
    private final String prefix;

    public S3ImageStorage(StorageProperties.S3 cfg) {
        this.cfg = cfg;
        S3ClientBuilder builder = S3Client.builder()
                .region(Region.of(cfg.regionOrDefault()))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(cfg.accessKey(), cfg.secretKey())))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(cfg.pathStyleAccess()).build());
        if (cfg.endpoint() != null && !cfg.endpoint().isBlank()) builder.endpointOverride(URI.create(cfg.endpoint()));
        this.client = builder.build();
        String pub = cfg.publicBaseUrl();
        if (pub == null || pub.isBlank()) {
            pub = cfg.endpoint() != null && !cfg.endpoint().isBlank()
                    ? cfg.endpoint().replaceAll("/+$", "") + "/" + cfg.bucket()
                    : "https://" + cfg.bucket() + ".s3." + cfg.regionOrDefault() + ".amazonaws.com";
        }
        this.prefix = pub.replaceAll("/+$", "") + "/";
    }

    @Override public String name() { return "s3"; }

    @Override public String publicPrefix() { return prefix; }

    @Override
    public String put(String key, byte[] data, String contentType) {
        try {
            client.putObject(PutObjectRequest.builder()
                            .bucket(cfg.bucket())
                            .key(key)
                            .contentType(contentType)
                            .cacheControl("public, max-age=31536000, immutable")
                            .build(),
                    RequestBody.fromBytes(data));
        } catch (RuntimeException e) {
            log.error("S3 upload failed for {}", key, e);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Image storage rejected the upload. Check the S3 settings.");
        }
        return prefix + key;
    }

    @Override
    public boolean owns(String url) { return url != null && url.startsWith(prefix); }

    @Override
    public void delete(String url) {
        if (!owns(url)) return;
        try {
            client.deleteObject(DeleteObjectRequest.builder().bucket(cfg.bucket()).key(url.substring(prefix.length())).build());
        } catch (RuntimeException e) {
            log.debug("Old image not removed from S3: {}", e.getMessage());
        }
    }
}
