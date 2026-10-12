package com.quickcommerce.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.quickcommerce.config.PaymentProperties;
import com.quickcommerce.integration.ExternalHttp;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

/**
 * Razorpay REST v1 (https://razorpay.com/docs/api/). Basic auth with key id/secret.
 * Orders → Checkout.js → signature verification → capture (if needed) → refunds; webhooks are verified
 * with the webhook secret.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RazorpayClient {

    private final PaymentProperties props;
    private final ExternalHttp http;
    private final ObjectMapper mapper;

    public boolean enabled() { return props.razorpay().enabled(); }

    public String keyId() { return props.razorpay().keyId(); }

    /** POST /v1/orders — amount in paise. */
    public JsonNode createOrder(String receipt, long amountPaise, Map<String, String> notes) {
        ObjectNode body = mapper.createObjectNode();
        body.put("amount", amountPaise);
        body.put("currency", "INR");
        body.put("receipt", receipt);
        body.put("payment_capture", 1);
        ObjectNode n = body.putObject("notes");
        notes.forEach(n::put);
        return call("create_order", post("/orders", body), false);
    }

    /** GET /v1/payments/{id}. */
    public JsonNode fetchPayment(String paymentId) {
        return call("fetch_payment", get("/payments/" + paymentId), true);
    }

    /** GET /v1/orders/{id}/payments — used to reconcile before a reservation expires. */
    public JsonNode fetchOrderPayments(String razorpayOrderId) {
        return call("fetch_order_payments", get("/orders/" + razorpayOrderId + "/payments"), true);
    }

    /** POST /v1/payments/{id}/capture — only needed when auto-capture is off for the account. */
    public JsonNode capture(String paymentId, long amountPaise) {
        ObjectNode body = mapper.createObjectNode();
        body.put("amount", amountPaise);
        body.put("currency", "INR");
        try {
            return call("capture", post("/payments/" + paymentId + "/capture", body), false);
        } catch (GatewayException e) {
            // Capturing an already-captured payment is harmless; treat it as success.
            if (e.getMessage() != null && e.getMessage().toLowerCase().contains("already been captured")) {
                return fetchPayment(paymentId);
            }
            throw e;
        }
    }

    /** POST /v1/payments/{id}/refund — full or partial refund; refund.processed webhook follows. */
    public JsonNode refund(String paymentId, long amountPaise, String receipt) {
        ObjectNode body = mapper.createObjectNode();
        body.put("amount", amountPaise);
        body.put("speed", "normal");
        body.put("receipt", receipt);
        return call("refund", post("/payments/" + paymentId + "/refund", body), false);
    }

    /** Checkout handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
    public boolean verifyPaymentSignature(String razorpayOrderId, String paymentId, String signature) {
        String expected = Crypto.hmacSha256Hex(razorpayOrderId + "|" + paymentId, props.razorpay().keySecret());
        return Crypto.safeEquals(expected, signature);
    }

    /** Webhook signature: HMAC_SHA256(raw body, webhook_secret) in X-Razorpay-Signature. */
    public boolean verifyWebhookSignature(String body, String signature) {
        String secret = props.razorpay().webhookSecret();
        if (secret == null || secret.isBlank()) return false;
        return Crypto.safeEquals(Crypto.hmacSha256Hex(body, secret), signature);
    }

    // ------------------------------------------------------------------ plumbing

    private HttpRequest get(String path) {
        return ExternalHttp.request(props.razorpay().base() + path, 15)
                .header("Authorization", basicAuth()).GET().build();
    }

    private HttpRequest post(String path, JsonNode body) {
        return ExternalHttp.request(props.razorpay().base() + path, 20)
                .header("Authorization", basicAuth())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString())).build();
    }

    private String basicAuth() {
        String raw = props.razorpay().keyId() + ":" + props.razorpay().keySecret();
        return "Basic " + Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private JsonNode call(String op, HttpRequest request, boolean idempotent) {
        if (!enabled()) throw new GatewayException("Razorpay isn't configured on this server.", "NOT_CONFIGURED");
        HttpResponse<String> res;
        try {
            res = http.send("razorpay", op, request, idempotent);
        } catch (ExternalHttp.ExternalCallException e) {
            throw new GatewayException("Razorpay is unreachable right now. Please try again.", "UNREACHABLE");
        }
        JsonNode json = parse(res.body());
        if (res.statusCode() >= 400) {
            String desc = json.path("error").path("description").asText("Razorpay rejected the request");
            String code = json.path("error").path("code").asText("BAD_REQUEST_ERROR");
            log.warn("Razorpay {} failed: {} {}", op, res.statusCode(), desc);
            throw new GatewayException("Razorpay: " + desc, code);
        }
        return json;
    }

    private JsonNode parse(String body) {
        try {
            return body == null || body.isBlank() ? mapper.createObjectNode() : mapper.readTree(body);
        } catch (Exception e) {
            return mapper.createObjectNode().put("raw", body);
        }
    }
}
