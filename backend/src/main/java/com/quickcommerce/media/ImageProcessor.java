package com.quickcommerce.media;

import com.quickcommerce.exception.ApiException;
import org.springframework.stereotype.Component;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Map;

/**
 * Normalises uploaded photos: decodes JPEG/PNG/GIF/BMP/WebP, caps the longest side, strips EXIF/metadata by
 * re-encoding (progressive JPEG, or PNG when the image has transparency). The storefront then serves WebP/AVIF
 * at the exact size each device needs through the Next.js image optimizer.
 */
@Component
public class ImageProcessor {

    public record Processed(byte[] bytes, String contentType, String extension, Integer width, Integer height) {}

    private static final Map<String, String> PASSTHROUGH = Map.of("image/avif", "avif", "image/webp", "webp", "image/gif", "gif");

    public Processed process(byte[] input, String declaredType, int maxDim, float quality) {
        BufferedImage src;
        try {
            src = ImageIO.read(new ByteArrayInputStream(input));
        } catch (IOException e) {
            src = null;
        }
        String type = declaredType == null ? "" : declaredType.toLowerCase();
        if (src == null) {
            // Formats ImageIO can't decode (e.g. AVIF) are stored untouched — the CDN/optimizer still resizes them.
            String ext = PASSTHROUGH.get(type);
            if (ext == null) throw ApiException.badRequest("That file isn't a supported image (JPG, PNG, WEBP, AVIF, GIF).");
            return new Processed(input, type, ext, null, null);
        }
        BufferedImage scaled = scaleDown(src, maxDim);
        boolean alpha = scaled.getColorModel().hasAlpha();
        try {
            if (alpha) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                ImageIO.write(scaled, "png", out);
                return new Processed(out.toByteArray(), "image/png", "png", scaled.getWidth(), scaled.getHeight());
            }
            return new Processed(jpeg(toRgb(scaled), quality), "image/jpeg", "jpg", scaled.getWidth(), scaled.getHeight());
        } catch (IOException e) {
            throw ApiException.badRequest("Could not process that image.");
        }
    }

    private static BufferedImage scaleDown(BufferedImage src, int maxDim) {
        int w = src.getWidth(), h = src.getHeight();
        if (Math.max(w, h) <= maxDim) return src;
        double ratio = (double) maxDim / Math.max(w, h);
        int tw = Math.max(1, (int) Math.round(w * ratio)), th = Math.max(1, (int) Math.round(h * ratio));
        BufferedImage current = src;
        int cw = w, ch = h;
        // Progressive halving keeps downscales sharp without the cost of an area-averaging filter.
        do {
            cw = Math.max(tw, cw / 2);
            ch = Math.max(th, ch / 2);
            int imgType = current.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
            BufferedImage next = new BufferedImage(cw, ch, imgType);
            Graphics2D g = next.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(current, 0, 0, cw, ch, null);
            g.dispose();
            current = next;
        } while (cw != tw || ch != th);
        return current;
    }

    private static BufferedImage toRgb(BufferedImage img) {
        if (img.getType() == BufferedImage.TYPE_INT_RGB) return img;
        BufferedImage rgb = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, img.getWidth(), img.getHeight());
        g.drawImage(img, 0, 0, null);
        g.dispose();
        return rgb;
    }

    private static byte[] jpeg(BufferedImage rgb, float quality) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) throw new IOException("No JPEG writer available");
        ImageWriter writer = writers.next();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(ios);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(Math.max(0.3f, Math.min(1f, quality)));
            param.setProgressiveMode(ImageWriteParam.MODE_DEFAULT);
            writer.write(null, new IIOImage(rgb, null, null), param);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
    }
}
