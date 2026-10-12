package com.quickcommerce.security;

import com.quickcommerce.config.AppProperties;
import com.quickcommerce.entity.AuthProvider;
import com.quickcommerce.entity.User;
import com.quickcommerce.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Converts a Google/GitHub login into our own JWT cookie session, then bounces back to the storefront. */
@Component
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    private final AuthService authService;
    private final AppProperties props;

    public OAuth2LoginSuccessHandler(AuthService authService, AppProperties props) {
        this.authService = authService;
        this.props = props;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
        OAuth2User oauthUser = token.getPrincipal();
        String registration = token.getAuthorizedClientRegistrationId();
        AuthProvider provider = "github".equals(registration) ? AuthProvider.GITHUB : AuthProvider.GOOGLE;

        String email = oauthUser.getAttribute("email");
        if (email == null && provider == AuthProvider.GITHUB) {
            email = oauthUser.getAttribute("login") + "@users.noreply.github.com";
        }
        String name = oauthUser.getAttribute("name");
        if (email == null) {
            response.sendRedirect(props.frontendUrl() + "/login?error=email_missing");
            return;
        }
        User user = authService.upsertOAuthUser(email, name, provider);
        authService.issueSession(user, response);
        request.getSession(false);
        response.sendRedirect(props.frontendUrl() + "/?login=success");
    }
}
