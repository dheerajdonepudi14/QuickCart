package com.quickcommerce.controller;

import com.quickcommerce.dto.AuthDtos.*;
import com.quickcommerce.dto.CommonDtos.MessageResponse;
import com.quickcommerce.security.AuthCookieService;
import com.quickcommerce.security.CurrentUser;
import com.quickcommerce.security.OAuthProviders;
import com.quickcommerce.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final OAuthProviders oauthProviders;
    private final com.quickcommerce.security.JwtTokenProvider tokenProvider;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest req, HttpServletResponse res) {
        return authService.register(req, res);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req, HttpServletResponse res) {
        return authService.login(req, res);
    }

    @PostMapping("/refresh-token")
    public AuthResponse refresh(HttpServletRequest req, HttpServletResponse res) {
        return authService.refresh(AuthCookieService.read(req, AuthCookieService.REFRESH_COOKIE).orElse(null), res);
    }

    @PostMapping("/logout")
    public MessageResponse logout(HttpServletRequest req, HttpServletResponse res) {
        authService.logout(AuthCookieService.read(req, AuthCookieService.REFRESH_COOKIE).orElse(null), res);
        return new MessageResponse("Logged out");
    }

    @GetMapping("/me")
    public UserResponse me() {
        return authService.me(CurrentUser.require().id());
    }

    /** Short-lived token for the STOMP CONNECT frame (see StompAuthChannelInterceptor). */
    @GetMapping("/ws-token")
    public java.util.Map<String, Object> wsToken() {
        return java.util.Map.of("token", tokenProvider.createSocketToken(CurrentUser.require()), "expiresInSeconds", 120);
    }

    @GetMapping("/providers")
    public ProvidersResponse providers() {
        return new ProvidersResponse(oauthProviders.enabledIds());
    }
}
