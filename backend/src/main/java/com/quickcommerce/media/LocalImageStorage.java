package com.quickcommerce.media;

import com.quickcommerce.config.StorageProperties;
import com.quickcommerce.exception.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Development default: files in the uploads folder, served by the backend at /uploads/** (see UploadsConfig). */
@Slf4j
public class LocalImageStorage implements ImageStorage {

    private final Path root;

    public LocalImageStorage(StorageProperties props) {
        this.root = Path.of(props.localDirectory()).toAbsolutePath().normalize();
    }

    @Override public String name() { return "local"; }

    @Override public String publicPrefix() { return "/uploads/"; }

    @Override
    public String put(String key, byte[] data, String contentType) {
        Path target = root.resolve(key).normalize();
        if (!target.startsWith(root)) throw ApiException.badRequest("Invalid storage key.");
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, data);
        } catch (IOException e) {
            log.error("Could not write {}", target, e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save the image. Try again.");
        }
        return publicPrefix() + key;
    }

    @Override
    public boolean owns(String url) { return url != null && url.startsWith(publicPrefix()); }

    @Override
    public void delete(String url) {
        if (!owns(url)) return;
        try {
            Path file = root.resolve(url.substring(publicPrefix().length())).normalize();
            if (file.startsWith(root)) Files.deleteIfExists(file);
        } catch (IOException | RuntimeException e) {
            log.debug("Old image not removed: {}", e.getMessage());
        }
    }
}
