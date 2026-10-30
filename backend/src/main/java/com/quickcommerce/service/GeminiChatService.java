package com.quickcommerce.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GeminiChatService {
    private final ObjectMapper objectMapper;

    @Value("${OPENROUTER_API_KEY:}")
    private String apiKey;

    @Value("${OPENROUTER_MODEL:liquid/lfm-2.5-2.6b:free}")
    private String model;

    public String chat(String message, List<ChatMessage> history) {
        if (apiKey == null || apiKey.isBlank()) {
            return localFallback(message);
        }
        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", model);
        ArrayNode messages = root.putArray("messages");
        messages.addObject().put("role", "system").put("content",
                "You are QuickCart Assistant, the exclusive shopping assistant for QuickCart. Help with groceries, " +
                "fresh-food recommendations, product search, delivery, cart, checkout, offers, refunds, and order tracking. " +
                "Be concise, friendly, and professional. Never claim to know live stock unless QuickCart tools provide it. " +
                "When relevant, suggest opening Browse, Cart, or Orders in QuickCart.");
        if (history != null) {
            for (ChatMessage item : history.stream().limit(12).toList()) {
                if (item.text() == null || item.text().isBlank()) continue;
                messages.addObject().put("role", "user".equalsIgnoreCase(item.role()) ? "user" : "assistant")
                        .put("content", item.text());
            }
        }
        messages.addObject().put("role", "user").put("content", message);
        root.put("temperature", 0.35).put("max_tokens", 700);

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://openrouter.ai/api/v1/chat/completions"))
                    .timeout(Duration.ofSeconds(45))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .header("HTTP-Referer", "http://localhost:3002")
                    .header("X-Title", "QuickCart")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root)))
                    .build();
            HttpResponse<String> response = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build()
                    .send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                return localFallback(message);
            }
            JsonNode payload = objectMapper.readTree(response.body());
            JsonNode text = payload.at("/choices/0/message/content");
            if (!text.isMissingNode() && !text.asText().isBlank()) {
                return text.asText().trim();
            }
            return localFallback(message);
        } catch (Exception ex) {
            return localFallback(message);
        }
    }

    private String localFallback(String message) {
        String query = message.toLowerCase();
        if (query.contains("track") || query.contains("order")) {
            return "You can track your order by opening Orders from the account menu, selecting your order, and choosing Track Delivery.";
        }
        if (query.contains("deliver") || query.contains("delivery") || query.contains("time") || query.contains("how long")) {
            return "Delivery availability and the estimated arrival time depend on your location and the selected store. Enter your delivery address at the top of QuickCart to see the latest estimate.";
        }
        if (query.contains("healthy") || query.contains("grocer") || query.contains("recommend") || query.contains("suggest")) {
            return "Try a balanced basket of fresh fruits, vegetables, whole grains, dairy, lentils, and protein-rich snacks. You can browse these in Categories and add them directly to your cart.";
        }
        if (query.contains("refund") || query.contains("cancel")) {
            return "To cancel an eligible order, open Orders, select the order, and choose Cancel. Approved refunds are normally returned to the original payment method.";
        }
        if (query.contains("cart") || query.contains("checkout")) {
            return "Open the Cart from the header to review items, quantities, and offers. Choose Proceed to Checkout when your basket is ready.";
        }
        if (query.contains("hello") || query.contains("hi ") || query.equals("hi")) {
            return "Hello! I can help you find groceries, check delivery information, review your cart, and track orders.";
        }
        return "I can help with groceries, delivery, your cart and checkout, offers, refunds, and order tracking. Tell me which product or QuickCart help you need.";
    }

    public record ChatMessage(String role, String text) {}
}
