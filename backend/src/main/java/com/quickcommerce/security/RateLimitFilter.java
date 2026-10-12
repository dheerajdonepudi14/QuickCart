package com.quickcommerce.security;

import com.quickcommerce.config.AppProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Fixed-window, per-client rate limiter (in-memory). Auth endpoints get a tighter budget to slow
 * credential stuffing. For multi-instance deployments swap the map for Redis INCR + EXPIRE.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private record Window(long minute, AtomicInteger count) {}

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final int generalLimit;
    private final int authLimit;

    public RateLimitFilter(AppProperties props) {
        this.generalLimit = props.rateLimit().requestsPerMinute();
        this.authLimit = props.rateLimit().authRequestsPerMinute();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // Gateway webhooks are signature-verified and must never be throttled.
        return !uri.startsWith("/api/") || (uri.startsWith("/api/v1/payments/") && uri.endsWith("/webhook"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        boolean authRoute = request.getRequestURI().startsWith("/api/v1/auth/")
                && !request.getRequestURI().endsWith("/me");
        String key = clientIp(request) + (authRoute ? ":auth" : ":api");
        int limit = authRoute ? authLimit : generalLimit;
        long minute = System.currentTimeMillis() / 60_000;

        Window w = windows.compute(key, (k, existing) ->
                existing == null || existing.minute() != minute ? new Window(minute, new AtomicInteger()) : existing);
        int used = w.count().incrementAndGet();

        response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, limit - used)));
        if (used > limit) {
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(60 - (System.currentTimeMillis() / 1000) % 60));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Too many requests. Wait a minute and try again.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    @Scheduled(fixedRate = 120_000)
    public void evictStaleWindows() {
        long minute = System.currentTimeMillis() / 60_000;
        windows.entrySet().removeIf(e -> e.getValue().minute() < minute - 1);
    }

    private static String clientIp(HttpServletRequest request) {
        String fwd = request.getHeader("X-Forwarded-For");
        return fwd != null && !fwd.isBlank() ? fwd.split(",")[0].trim() : request.getRemoteAddr();
    }
}
