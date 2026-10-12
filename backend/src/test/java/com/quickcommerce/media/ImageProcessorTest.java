package com.quickcommerce.media;

import com.quickcommerce.exception.ApiException;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class ImageProcessorTest {

    private final ImageProcessor processor = new ImageProcessor();

    private static byte[] png(int w, int h, int type) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(w, h, type), "png", out);
        return out.toByteArray();
    }

    @Test
    void largePhotosAreResizedToJpeg() throws Exception {
        ImageProcessor.Processed p = processor.process(png(4000, 3000, BufferedImage.TYPE_INT_RGB), "image/png", 1600, 0.8f);
        assertEquals("image/jpeg", p.contentType());
        assertEquals(1600, p.width());
        assertEquals(1200, p.height());
    }

    @Test
    void transparentImagesStayPng() throws Exception {
        ImageProcessor.Processed p = processor.process(png(500, 500, BufferedImage.TYPE_INT_ARGB), "image/png", 1600, 0.8f);
        assertEquals("image/png", p.contentType());
        assertEquals(500, p.width());
    }

    @Test
    void garbageIsRejected() {
        assertThrows(ApiException.class, () -> processor.process("not an image".getBytes(), "image/jpeg", 1600, 0.8f));
    }
}
