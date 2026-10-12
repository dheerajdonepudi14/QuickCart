package com.quickcommerce.service;

import com.quickcommerce.config.AppProperties;
import com.quickcommerce.dto.AuthDtos.*;
import com.quickcommerce.entity.AuthProvider;
import com.quickcommerce.entity.RefreshToken;
import com.quickcommerce.entity.Role;
import com.quickcommerce.entity.User;
import com.quickcommerce.exception.ApiException;
import com.quickcommerce.repository.RefreshTokenRepository;
import com.quickcommerce.repository.UserRepository;
import com.quickcommerce.security.AuthCookieService;
import com.quickcommerce.security.JwtTokenProvider;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AuthCookieService cookieService;
    private final AppProperties props;

    @Transactional
    public AuthResponse register(RegisterRequest req, HttpServletResponse response) {
        String email = req.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("An account with this email already exists. Log in instead.");
        }
        String phone = req.phoneNumber() == null || req.phoneNumber().isBlank() ? null : req.phoneNumber().trim();
        if (phone != null && userRepository.existsByPhoneNumber(phone)) {
            throw ApiException.conflict("This phone number is linked to another account.");
        }
        User user = new User();
        user.setFullName(req.fullName().trim());
        user.setEmail(email);
        user.setPhoneNumber(phone);
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(Role.ROLE_CUSTOMER);
        user.setProvider(AuthProvider.LOCAL);
        user.recordLogin();
        userRepository.save(user);
        return issueSession(user, response);
    }

    @Transactional
    public AuthResponse login(LoginRequest req, HttpServletResponse response) {
        User user = userRepository.findByEmailIgnoreCase(req.email().trim())
                .filter(u -> u.getPasswordHash() != null && passwordEncoder.matches(req.password(), u.getPasswordHash()))
                .orElseThrow(() -> ApiException.unauthorized("Email or password is incorrect."));
        user.recordLogin();
        return issueSession(user, response);
    }

    /** Rotating refresh: the presented token is revoked and a new pair is issued. Reuse of a revoked token kills all sessions. */
    @Transactional
    public AuthResponse refresh(String rawRefreshToken, HttpServletResponse response) {
        if (rawRefreshToken == null) throw ApiException.unauthorized("Your session has ended. Log in again.");
        RefreshToken stored = refreshTokenRepository.findByTokenHash(JwtTokenProvider.sha256(rawRefreshToken))
                .orElseThrow(() -> ApiException.unauthorized("Your session has ended. Log in again."));
        if (stored.isRevoked()) {
            refreshTokenRepository.revokeAllForUser(stored.getUser().getId());
            cookieService.clear(response);
            throw ApiException.unauthorized("Your session was signed out for security. Log in again.");
        }
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized("Your session has ended. Log in again.");
        }
        stored.setRevoked(true);
        return issueSession(stored.getUser(), response);
    }

    @Transactional
    public void logout(String rawRefreshToken, HttpServletResponse response) {
        if (rawRefreshToken != null) {
            refreshTokenRepository.findByTokenHash(JwtTokenProvider.sha256(rawRefreshToken))
                    .ifPresent(t -> t.setRevoked(true));
        }
        cookieService.clear(response);
    }

    @Transactional(readOnly = true)
    public UserResponse me(Long userId) {
        return toResponse(userRepository.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("Account not found.")));
    }

    /** Find-or-create for Google/GitHub sign-in. */
    @Transactional
    public User upsertOAuthUser(String email, String name, AuthProvider provider) {
        User user = userRepository.findByEmailIgnoreCase(email).orElseGet(() -> {
            User u = new User();
            u.setEmail(email.toLowerCase());
            u.setFullName(name == null || name.isBlank() ? email.substring(0, email.indexOf('@')) : name);
            u.setProvider(provider);
            u.setRole(Role.ROLE_CUSTOMER);
            return userRepository.save(u);
        });
        user.recordLogin();
        return user;
    }

    @Transactional
    public AuthResponse issueSession(User user, HttpServletResponse response) {
        String access = tokenProvider.createAccessToken(user);
        String refresh = tokenProvider.newRefreshToken();
        RefreshToken rt = new RefreshToken();
        rt.setUser(user);
        rt.setTokenHash(JwtTokenProvider.sha256(refresh));
        rt.setExpiresAt(Instant.now().plus(Duration.ofDays(props.jwt().refreshTokenTtlDays())));
        refreshTokenRepository.save(rt);
        cookieService.writeTokens(response, access, refresh);
        return new AuthResponse(toResponse(user), tokenProvider.accessTtlSeconds());
    }

    public static UserResponse toResponse(User u) {
        return new UserResponse(u.getId(), u.getFullName(), u.getEmail(), u.getPhoneNumber(), u.getRole().name(),
                u.getProvider().name(), u.getStore() != null ? u.getStore().getId() : null,
                u.getStore() != null ? u.getStore().getName() : null);
    }

    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public void purgeExpiredRefreshTokens() {
        refreshTokenRepository.purgeExpired(Instant.now());
    }
}
