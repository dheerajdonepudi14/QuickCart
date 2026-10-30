package com.quickcommerce.security;

import com.quickcommerce.config.AppProperties;
import com.quickcommerce.entity.Role;
import com.quickcommerce.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
public class JwtTokenProvider {

    private static final String ISSUER = "quickcart";
    private final SecretKey key;
    private final Duration accessTtl;
    private final SecureRandom random = new SecureRandom();

    public JwtTokenProvider(AppProperties props) {
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(props.jwt().secret()));
        this.accessTtl = Duration.ofMinutes(props.jwt().accessTokenTtlMinutes());
    }

    public String createAccessToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(ISSUER)
                .subject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .claim("roles", List.of(user.getRole().name()))
                .claim("storeId", user.getStore() != null ? user.getStore().getId() : null)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTtl)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public Optional<UserPrincipal> parse(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        try {
            Claims c = Jwts.parser().verifyWith(key).requireIssuer(ISSUER).build()
                    .parseSignedClaims(token).getPayload();
            @SuppressWarnings("unchecked")
            List<String> roles = c.get("roles", List.class);
            Number storeId = c.get("storeId", Number.class);
            return Optional.of(new UserPrincipal(Long.valueOf(c.getSubject()), c.get("email", String.class),
                    Role.valueOf(roles.get(0)), storeId == null ? null : storeId.longValue()));
        } catch (JwtException | IllegalArgumentException ex) {
            log.debug("Rejected JWT: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    public long accessTtlSeconds() { return accessTtl.toSeconds(); }

    /** Opaque, high-entropy refresh token; only its SHA-256 hash is stored. */
    public String newRefreshToken() {
        byte[] bytes = new byte[48];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes()));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
