package com.quickcommerce.integration;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.ThreadLocalRandom;

/**
 * One HTTP client for every third-party call (payment gateways, maps, storage, Slack).
 * Adds retries with exponential backoff + jitter for transient failures, per-call metrics
 * (quickcart.external.calls) and a log line per call so gateway traffic can be reconciled.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExternalHttp {

    private final MeterRegistry meters;

    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    /** Thrown after retries are exhausted or for a non-retryable transport failure. */
    public static class ExternalCallException extends RuntimeException {
        private final int status;
        private final String body;

        public ExternalCallException(String message, int status, String body, Throwable cause) {
            super(message, cause);
            this.status = status;
            this.body = body;
        }

        public int status() { return status; }
        public String body() { return body; }
    }

    /**
     * Sends the request. {@code idempotent} calls (GETs, or POSTs carrying an idempotency key) are retried on
     * network errors, 429 and 5xx; others are attempted once so a payment is never created twice.
     */
    public HttpResponse<String> send(String service, String operation, HttpRequest request, boolean idempotent) {
        int maxAttempts = idempotent ? 3 : 1;
        long backoffMs = 300;
        ExternalCallException last = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            Timer.Sample sample = Timer.start(meters);
            String outcome = "error";
            try {
                HttpResponse<String> res = client.send(request, HttpResponse.BodyHandlers.ofString());
                int code = res.statusCode();
                outcome = code < 400 ? "success" : "http_" + code;
                log.info("external call service={} op={} method={} status={} attempt={}", service, operation,
                        request.method(), code, attempt);
                if ((code == 429 || code >= 500) && attempt < maxAttempts) {
                    last = new ExternalCallException(service + " " + operation + " returned " + code, code, res.body(), null);
                } else {
                    return res;
                }
            } catch (IOException e) {
                log.warn("external call service={} op={} failed attempt={}: {}", service, operation, attempt, e.toString());
                last = new ExternalCallException(service + " is unreachable", 0, null, e);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new ExternalCallException(service + " call interrupted", 0, null, e);
            } finally {
                sample.stop(meters.timer("quickcart.external.calls", "service", service, "operation", operation,
                        "outcome", outcome));
            }
            if (attempt < maxAttempts) {
                sleep(backoffMs + ThreadLocalRandom.current().nextLong(100));
                backoffMs *= 3;
            }
        }
        throw last != null ? last : new ExternalCallException(service + " call failed", 0, null, null);
    }

    public static HttpRequest.Builder request(String url, int timeoutSeconds) {
        return HttpRequest.newBuilder(java.net.URI.create(url)).timeout(Duration.ofSeconds(timeoutSeconds));
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
