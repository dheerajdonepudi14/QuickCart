package com.quickcommerce.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quickcommerce.config.PaymentProperties;
import com.quickcommerce.integration.ExternalHttp;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * PhonePe Payment Gateway — Standard Checkout v2.
 * Sandbox: api-preprod.phonepe.com/apis/pg-sandbox, Production: api.phonepe.com/apis/pg.
 * Auth: OAuth client-credentials token sent as "Authorization: O-Bearer &lt;token&gt;".
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PhonePeClient {

    private final PaymentProperties props;
    private final ExternalHttp http;
    private final ObjectMapper mapper;

    private volatile String accessToken;
    private volatile long accessTokenExpiresAt; // epoch seconds

    public boolean enabled() { return props.phonepe().enabled(); }

    public boolean sandbox() { return props.phonepe().sandbox(); }

    /** POST /checkout/v2/pay → { orderId, state, expireAt, redirectUrl }. */
    public JsonNode pay(String merchantOrderId, long amountPaise, String redirectUrl, String orderNumber) {
        ObjectNode body = mapper.createObjectNode();
        body.put("merchantOrderId", merchantOrderId);
        body.put("amount", amountPaise);
        body.put("expireAfter", props.phonepe().expireAfter());
        body.putObject("metaInfo").put("udf1", orderNumber);
        ObjectNode flow = body.putObject("paymentFlow");
        flow.put("type", "PG_CHECKOUT");
        flow.put("message", "QuickCart order " + orderNumber);
        flow.putObject("merchantUrls").put("redirectUrl", redirectUrl);
        body.put("disablePaymentRetry", false);
        return call("pay", "/checkout/v2/pay", "POST", body, false);
    }

    /** GET /checkout/v2/order/{merchantOrderId}/status → state PENDING | COMPLETED | FAILED. */
    public JsonNode status(String merchantOrderId) {
        return call("order_status", "/checkout/v2/order/" + enc(merchantOrderId) + "/status?details=false",
                "GET", null, true);
    }

    /** POST /payments/v2/refund. */
    public JsonNode refund(String merchantRefundId, String originalMerchantOrderId, long amountPaise) {
        ObjectNode body = mapper.createObjectNode();
        body.put("merchantRefundId", merchantRefundId);
        body.put("originalMerchantOrderId", originalMerchantOrderId);
        body.put("amount", amountPaise);
        return call("refund", "/payments/v2/refund", "POST", body, false);
    }

    /** GET /payments/v2/refund/{merchantRefundId}/status. */
    public JsonNode refundStatus(String merchantRefundId) {
        return call("refund_status", "/payments/v2/refund/" + enc(merchantRefundId) + "/status", "GET", null, true);
    }

    /**
     * PhonePe signs callbacks with Authorization: SHA256(username:password) using the credentials you set in
     * the PhonePe business dashboard. Accepts the bare hex digest or the "SHA256(...)" wrapped form.
     */
    public boolean verifyWebhook(String authorizationHeader) {
        String user = props.phonepe().webhookUsername();
        String pass = props.phonepe().webhookPassword();
        if (authorizationHeader == null || user == null || user.isBlank() || pass == null || pass.isBlank()) return false;
        String value = authorizationHeader.trim();
        if (value.toUpperCase().startsWith("SHA256(") && value.endsWith(")")) value = value.substring(7, value.length() - 1);
        return Crypto.safeEquals(Crypto.sha256Hex(user + ":" + pass), value);
    }

    // ------------------------------------------------------------------ plumbing

    private JsonNode call(String op, String path, String method, JsonNode body, boolean idempotent) {
        if (!enabled()) throw new GatewayException("PhonePe isn't configured on this server.", "NOT_CONFIGURED");
        HttpResponse<String> res = send(op, path, method, body, idempotent, token(false));
        if (res.statusCode() == 401) {
            res = send(op, path, method, body, idempotent, token(true)); // token revoked/expired early
        }
        JsonNode json = parse(res.body());
        if (res.statusCode() >= 400) {
            String msg = json.path("message").asText(json.path("code").asText("PhonePe rejected the request"));
            log.warn("PhonePe {} failed: {} {}", op, res.statusCode(), msg);
            throw new GatewayException("PhonePe: " + msg, json.path("code").asText("PHONEPE_ERROR"));
        }
        return json;
    }

    private HttpResponse<String> send(String op, String path, String method, JsonNode body, boolean idempotent, String token) {
        HttpRequest.Builder b = ExternalHttp.request(props.phonepe().baseUrl() + path, 20)
                .header("Authorization", "O-Bearer " + token)
                .header("Content-Type", "application/json");
        HttpRequest req = "GET".equals(method) ? b.GET().build()
                : b.POST(HttpRequest.BodyPublishers.ofString(body == null ? "{}" : body.toString())).build();
        try {
            return http.send("phonepe", op, req, idempotent);
        } catch (ExternalHttp.ExternalCallException e) {
            throw new GatewayException("PhonePe is unreachable right now. Please try again.", "UNREACHABLE");
        }
    }

    /** Cached OAuth token, refreshed a minute before expiry. */
    private synchronized String token(boolean forceRefresh) {
        long now = Instant.now().getEpochSecond();
        if (!forceRefresh && accessToken != null && accessTokenExpiresAt - 60 > now) return accessToken;
        PaymentProperties.PhonePe cfg = props.phonepe();
        String form = "client_id=" + enc(cfg.clientId())
                + "&client_version=" + cfg.version()
                + "&client_secret=" + enc(cfg.clientSecret())
                + "&grant_type=client_credentials";
        HttpRequest req = ExternalHttp.request(cfg.authUrl(), 15)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form)).build();
        HttpResponse<String> res;
        try {
            res = http.send("phonepe", "oauth_token", req, true);
        } catch (ExternalHttp.ExternalCallException e) {
            throw new GatewayException("PhonePe is unreachable right now. Please try again.", "UNREACHABLE");
        }
        JsonNode json = parse(res.body());
        if (res.statusCode() >= 400 || !json.hasNonNull("access_token")) {
            log.error("PhonePe token request failed: {}", res.statusCode());
            throw new GatewayException("PhonePe credentials were rejected. Check PHONEPE_CLIENT_ID / SECRET.", "AUTH_FAILED");
        }
        accessToken = json.get("access_token").asText();
        long expiresAt = json.path("expires_at").asLong(0);
        accessTokenExpiresAt = expiresAt > now ? expiresAt : now + 3000;
        return accessToken;
    }

    private JsonNode parse(String body) {
        try {
            return body == null || body.isBlank() ? mapper.createObjectNode() : mapper.readTree(body);
        } catch (Exception e) {
            return mapper.createObjectNode().put("raw", body);
        }
    }

    private static String enc(String v) {
        return URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8);
    }
}
