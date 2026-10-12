package com.quickcommerce.websocket;

import com.quickcommerce.security.AuthCookieService;
import com.quickcommerce.security.JwtTokenProvider;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

/** Binds the HttpOnly JWT cookie sent with the SockJS/WebSocket handshake to the STOMP session. */
@Component
public class JwtHandshakeHandler extends DefaultHandshakeHandler {

    private final JwtTokenProvider tokenProvider;

    public JwtHandshakeHandler(JwtTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    @Override
    protected Principal determineUser(ServerHttpRequest request, WebSocketHandler wsHandler, Map<String, Object> attributes) {
        if (request instanceof ServletServerHttpRequest servlet) {
            return tokenProvider.parseNewest(AuthCookieService.readAll(servlet.getServletRequest(), AuthCookieService.ACCESS_COOKIE))
                    .map(p -> (Principal) p)
                    .orElse(null);
        }
        return null;
    }
}
