package com.quickcommerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Indian payment gateways. Every gateway is switched on only when its credentials are present,
 * so the app always boots; the checkout page lists whatever is configured.
 */
@ConfigurationProperties(prefix = "app.payments")
public record PaymentProperties(Razorpay razorpay, PhonePe phonepe, Upi upi, Webhooks webhooks) {

    private static boolean has(String v) { return v != null && !v.isBlank(); }

    /** https://razorpay.com/docs/api — test keys start with rzp_test_, live keys with rzp_live_. */
    public record Razorpay(String keyId, String keySecret, String webhookSecret, String businessName,
                           String themeColor, String apiBase) {
        public boolean enabled() { return has(keyId) && has(keySecret); }
        public boolean testMode() { return has(keyId) && keyId.startsWith("rzp_test_"); }
        public String base() { return has(apiBase) ? apiBase : "https://api.razorpay.com/v1"; }
    }

    /** PhonePe PG Standard Checkout v2 (OAuth client credentials). environment = SANDBOX | PRODUCTION. */
    public record PhonePe(String clientId, String clientSecret, Integer clientVersion, String environment,
                          String webhookUsername, String webhookPassword, Integer expireAfterSeconds) {
        public boolean enabled() { return has(clientId) && has(clientSecret); }
        public boolean sandbox() { return !"PRODUCTION".equalsIgnoreCase(environment); }
        public String baseUrl() {
            return sandbox() ? "https://api-preprod.phonepe.com/apis/pg-sandbox" : "https://api.phonepe.com/apis/pg";
        }
        public String authUrl() {
            return sandbox() ? "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token"
                    : "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";
        }
        public int version() { return clientVersion == null ? 1 : clientVersion; }
        public int expireAfter() { return expireAfterSeconds == null ? 600 : expireAfterSeconds; }
    }

    /**
     * Direct UPI collect via intent / QR (Google Pay, PhonePe, Paytm, BHIM…). Without a PSP there is no
     * automatic confirmation: the store verifies the UTR, or in sandbox mode the payment auto-confirms.
     */
    public record Upi(String vpa, String payeeName, String merchantCode, Boolean sandboxAutoConfirm,
                      Integer sandboxConfirmSeconds) {
        public boolean enabled() { return has(vpa); }
        public boolean autoConfirm() { return sandboxAutoConfirm == null || sandboxAutoConfirm; }
        public int confirmSeconds() { return sandboxConfirmSeconds == null ? 8 : sandboxConfirmSeconds; }
        public String name() { return has(payeeName) ? payeeName : "QuickCart"; }
    }

    /** Failed webhook processing is retried with exponential backoff up to maxAttempts. */
    public record Webhooks(Integer maxAttempts) {
        public int attempts() { return maxAttempts == null ? 8 : maxAttempts; }
    }

    public Razorpay razorpay() { return razorpay != null ? razorpay : new Razorpay(null, null, null, null, null, null); }
    public PhonePe phonepe() { return phonepe != null ? phonepe : new PhonePe(null, null, null, null, null, null, null); }
    public Upi upi() { return upi != null ? upi : new Upi(null, null, null, null, null); }
    public Webhooks webhooks() { return webhooks != null ? webhooks : new Webhooks(null); }
}
