package com.quickcommerce.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickcommerce.config.AlertProperties;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.net.http.HttpRequest;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Operational alerts to Slack (incoming webhook). Sent asynchronously and only after the surrounding
 * transaction commits, so a rolled-back order never pings the team and Slack latency never slows checkout.
 */
@Slf4j
@Service
public class AlertService {

    public enum Kind { ORDER, STOCK, PAYMENT, SYSTEM }

    private final AlertProperties props;
    private final ExternalHttp http;
    private final ObjectMapper mapper;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "slack-alerts");
        t.setDaemon(true);
        return t;
    });

    public AlertService(AlertProperties props, ExternalHttp http, ObjectMapper mapper) {
        this.props = props;
        this.http = http;
        this.mapper = mapper;
        if (props.slackEnabled()) log.info("Slack alerts enabled");
    }

    public boolean enabled() { return props.slackEnabled(); }

    public void notify(Kind kind, String text) {
        if (!props.slackEnabled() || !wanted(kind)) return;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { submit(text); }
            });
        } else {
            submit(text);
        }
    }

    private boolean wanted(Kind kind) {
        return switch (kind) {
            case ORDER -> props.orders();
            case STOCK -> props.stock();
            case PAYMENT -> props.payments();
            case SYSTEM -> true;
        };
    }

    private void submit(String text) {
        executor.submit(() -> {
            try {
                String body = mapper.writeValueAsString(Map.of("text", text));
                HttpRequest req = ExternalHttp.request(props.slackWebhookUrl(), 10)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body)).build();
                int code = http.send("slack", "post_alert", req, true).statusCode();
                if (code >= 400) log.warn("Slack alert rejected with HTTP {}", code);
            } catch (Exception e) {
                log.warn("Slack alert not delivered: {}", e.getMessage());
            }
        });
    }

    @PreDestroy
    void shutdown() { executor.shutdown(); }
}
