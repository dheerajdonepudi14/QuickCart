package com.quickcommerce.config;

import com.quickcommerce.security.JwtAuthenticationFilter;
import com.quickcommerce.security.OAuthProviders;
import com.quickcommerce.security.OAuth2LoginSuccessHandler;
import com.quickcommerce.security.RateLimitFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final RateLimitFilter rateLimitFilter;
    private final OAuth2LoginSuccessHandler oauth2SuccessHandler;
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(SecurityConfig.class);
    private final OAuthProviders oauthProviders;
    private final AppProperties props;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter, RateLimitFilter rateLimitFilter,
                          OAuth2LoginSuccessHandler oauth2SuccessHandler,
                          OAuthProviders oauthProviders, AppProperties props) {
        this.jwtFilter = jwtFilter;
        this.rateLimitFilter = rateLimitFilter;
        this.oauth2SuccessHandler = oauth2SuccessHandler;
        this.oauthProviders = oauthProviders;
        this.props = props;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Stateless JWT in SameSite cookies; CSRF tokens are unnecessary for this API surface.
            .csrf(AbstractHttpConfigurer::disable)
            .cors(c -> c.configurationSource(corsConfigurationSource()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)) // OAuth2 handshake needs a short session
            .formLogin(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/refresh-token",
                        "/api/v1/auth/logout", "/api/v1/auth/providers").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/catalog/**", "/api/v1/stores/**", "/api/v1/checkout/coupons").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/checkout/quote", "/api/v1/newsletter").permitAll()
                .requestMatchers("/api/v1/payments/stripe/webhook", "/api/v1/payments/razorpay/webhook",
                        "/api/v1/payments/phonepe/webhook", "/api/v1/payments/config").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/geo/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/events/images").permitAll()
                .requestMatchers("/ws-tracker/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/uploads/**", "/api/v1/stats").permitAll()
                .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**", "/actuator/health",
                        "/actuator/health/**", "/actuator/info", "/actuator/prometheus").permitAll()
                .requestMatchers("/api/v1/admin/**").hasAuthority("ROLE_STORE_ADMIN")
                .requestMatchers("/api/v1/delivery/**").hasAuthority("ROLE_DELIVERY_PARTNER")
                .anyRequest().authenticated())
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) -> writeError(res, HttpStatus.UNAUTHORIZED, "Log in to continue."))
                .accessDeniedHandler((req, res, ex) -> writeError(res, HttpStatus.FORBIDDEN, "You don't have access to this resource.")))
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        if (oauthProviders.enabled().isEmpty()) {
            log.info("OAuth sign-in: off (set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET or GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET to enable)");
        } else {
            log.info("OAuth sign-in: enabled for {} (redirect URI: <backend-url>/login/oauth2/code/<provider>)",
                    oauthProviders.enabledIds());
            http.oauth2Login(o -> o
                    .clientRegistrationRepository(oauthProviders.enabledRepository())
                    .successHandler(oauth2SuccessHandler)
                    .failureHandler((req, res, ex) -> res.sendRedirect(props.frontendUrl() + "/login?error=oauth")));
        }
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(props.cors().allowedOrigins());
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setExposedHeaders(List.of("X-RateLimit-Remaining", "Retry-After", "X-Request-Id"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    /** These filters run inside the security chain; stop Boot from also registering them globally. */
    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(JwtAuthenticationFilter f) {
        FilterRegistrationBean<JwtAuthenticationFilter> reg = new FilterRegistrationBean<>(f);
        reg.setEnabled(false);
        return reg;
    }

    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(RateLimitFilter f) {
        FilterRegistrationBean<RateLimitFilter> reg = new FilterRegistrationBean<>(f);
        reg.setEnabled(false);
        return reg;
    }

    private static void writeError(jakarta.servlet.http.HttpServletResponse res, HttpStatus status, String message)
            throws java.io.IOException {
        res.setStatus(status.value());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.getWriter().write("{\"status\":" + status.value() + ",\"error\":\"" + status.getReasonPhrase()
                + "\",\"message\":\"" + message + "\"}");
    }
}
