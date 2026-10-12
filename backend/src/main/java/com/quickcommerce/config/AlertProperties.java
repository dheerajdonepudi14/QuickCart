package com.quickcommerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Operational alerts. Slack incoming-webhook URL from https://api.slack.com/messaging/webhooks. */
@ConfigurationProperties(prefix = "app.alerts")
public record AlertProperties(String slackWebhookUrl, Boolean orderAlerts, Boolean stockAlerts, Boolean paymentAlerts) {
    public boolean slackEnabled() { return slackWebhookUrl != null && slackWebhookUrl.startsWith("https://"); }
    public boolean orders() { return orderAlerts == null || orderAlerts; }
    public boolean stock() { return stockAlerts == null || stockAlerts; }
    public boolean payments() { return paymentAlerts == null || paymentAlerts; }
}
