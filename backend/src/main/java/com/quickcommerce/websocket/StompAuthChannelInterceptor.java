package com.quickcommerce.websocket;

import com.quickcommerce.security.JwtTokenProvider;
import com.quickcommerce.security.UserPrincipal;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Authorises every STOMP frame:
 *  /topic/orders/{id}/**  -> order owner, assigned rider, or that store's admin
 *  /topic/stores/{id}/**  -> that store's admin
 *  /app/orders/{id}/location -> assigned rider or store admin
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(StompAuthChannelInterceptor.class);

    private static final Pattern ORDER_TOPIC = Pattern.compile("^/topic/orders/(\\d+)(/.*)?$");
    private static final Pattern STORE_TOPIC = Pattern.compile("^/topic/stores/(\\d+)(/.*)?$");
    private static final Pattern LOCATION_SEND = Pattern.compile("^/app/orders/(\\d+)/location$");

    private final JwtTokenProvider tokenProvider;
    private final OrderAccessService access;

    public StompAuthChannelInterceptor(JwtTokenProvider tokenProvider, OrderAccessService access) {
        this.tokenProvider = tokenProvider;
        this.access = access;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) return message;

        StompCommand cmd = accessor.getCommand();
        if (cmd == StompCommand.CONNECT) {
            // The browser fetches a short-lived token from /api/v1/auth/ws-token right before connecting,
            // so the socket identity always matches the REST session (the handshake cookie can be stale or expired).
            String header = accessor.getFirstNativeHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) {
                tokenProvider.parse(header.substring(7)).ifPresent(accessor::setUser);
            }
        }
        UserPrincipal user = resolve(accessor.getUser());
        String dest = accessor.getDestination();

        if (cmd == StompCommand.SUBSCRIBE && dest != null) {
            Matcher m;
            String reason = null;
            if ((m = ORDER_TOPIC.matcher(dest)).matches()) {
                if (!access.canView(user, Long.valueOf(m.group(1)))) reason = "not this user's order";
            } else if ((m = STORE_TOPIC.matcher(dest)).matches()) {
                if (user == null || !user.canManageStore(Long.valueOf(m.group(1)))) reason = "store feed is for that store's admins";
            } else if (!dest.startsWith("/user/")) {
                reason = "unknown destination";
            }
            if (reason != null) {
                // Drop just this subscription. Throwing here makes Spring send an ERROR frame and close the
                // socket, and the browser then reconnects and re-subscribes every few seconds forever.
                log.warn("STOMP subscribe denied: dest={} user={} ({})", dest, user == null ? "anonymous" : user.id(), reason);
                return null;
            }
        }
        if (cmd == StompCommand.SEND && dest != null) {
            Matcher m = LOCATION_SEND.matcher(dest);
            if (m.matches() && !access.canPushLocation(user, Long.valueOf(m.group(1)))) {
                log.warn("STOMP location push denied: dest={} user={}", dest, user == null ? "anonymous" : user.id());
                return null;
            }
        }
        return message;
    }

    static UserPrincipal resolve(Principal principal) {
        return principal instanceof UserPrincipal p ? p : null;
    }
}
