package com.quickcommerce.config;

import com.quickcommerce.websocket.JwtHandshakeHandler;
import com.quickcommerce.websocket.StompAuthChannelInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtHandshakeHandler handshakeHandler;
    private final StompAuthChannelInterceptor authInterceptor;
    private final AppProperties props;

    public WebSocketConfig(JwtHandshakeHandler handshakeHandler, StompAuthChannelInterceptor authInterceptor,
                           AppProperties props) {
        this.handshakeHandler = handshakeHandler;
        this.authInterceptor = authInterceptor;
        this.props = props;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // In-memory broker. Swap for enableStompBrokerRelay(...) (RabbitMQ/ActiveMQ) when running several instances.
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = props.cors().allowedOrigins().toArray(String[]::new);
        registry.addEndpoint("/ws-tracker")
                .setHandshakeHandler(handshakeHandler)
                .setAllowedOriginPatterns(origins)
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authInterceptor);
    }
}
