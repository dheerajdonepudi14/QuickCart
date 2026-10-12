package com.quickcommerce.security;

import com.quickcommerce.config.AppProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Component
public class AuthCookieService {
    public static final String ACCESS_COOKIE = "qc_access";
    public static final String REFRESH_COOKIE = "qc_refresh";
    private static final String REFRESH_PATH = "/api/v1/auth";

    private final AppProperties props;

    public AuthCookieService(AppProperties props) {
        this.props = props;
    }

    public void writeTokens(HttpServletResponse response, String accessToken, String refreshToken) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(ACCESS_COOKIE, accessToken, "/",
                Duration.ofMinutes(props.jwt().accessTokenTtlMinutes())).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(REFRESH_COOKIE, refreshToken, REFRESH_PATH,
                Duration.ofDays(props.jwt().refreshTokenTtlDays())).toString());
    }

    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(ACCESS_COOKIE, "", "/", Duration.ZERO).toString());
        // Also expire copies an older build may have left under narrower paths.
        for (String legacy : LEGACY_ACCESS_PATHS) {
            response.addHeader(HttpHeaders.SET_COOKIE, cookie(ACCESS_COOKIE, "", legacy, Duration.ZERO).toString());
        }
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(REFRESH_COOKIE, "", REFRESH_PATH, Duration.ZERO).toString());
    }

    private static final String[] LEGACY_ACCESS_PATHS = {"/api", "/api/v1", "/api/v1/auth"};

    /** Every non-blank cookie with this name (browsers may send several with different paths). */
    public static List<String> readAll(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return List.of();
        return Arrays.stream(cookies).filter(c -> name.equals(c.getName())).map(Cookie::getValue)
                .filter(v -> v != null && !v.isBlank()).toList();
    }

    public static Optional<String> read(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return Optional.empty();
        return Arrays.stream(cookies).filter(c -> name.equals(c.getName())).map(Cookie::getValue)
                .filter(v -> !v.isBlank()).findFirst();
    }

    private ResponseCookie cookie(String name, String value, String path, Duration maxAge) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(props.jwt().cookieSecure())
                .sameSite(props.jwt().cookieSecure() ? "None" : "Lax")
                .path(path)
                .maxAge(maxAge)
                .build();
    }
}
