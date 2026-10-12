-- =====================================================================
-- V5: payment gateways (Razorpay / PhonePe / UPI), webhook idempotency,
--     checkout idempotency keys, structured addresses with geocoding,
--     image metadata + A/B variants, rider telemetry freshness.
-- =====================================================================

-- ---------- Payments ----------
CREATE TABLE payment_transactions (
    id                  BIGSERIAL PRIMARY KEY,
    order_id            BIGINT       NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    gateway             VARCHAR(20)  NOT NULL,   -- STRIPE, RAZORPAY, PHONEPE, UPI, MOCK
    gateway_order_id    VARCHAR(120),            -- razorpay order_xxx / phonepe merchantOrderId / UPI tr
    gateway_payment_id  VARCHAR(120),            -- razorpay pay_xxx / phonepe transactionId / UTR
    status              VARCHAR(30)  NOT NULL,   -- CREATED, PENDING, PENDING_VERIFICATION, SUCCESS, FAILED, REFUND_PENDING, REFUNDED, REFUND_FAILED
    amount              DECIMAL(10,2) NOT NULL,
    currency            VARCHAR(3)   NOT NULL DEFAULT 'INR',
    attempt             INT          NOT NULL DEFAULT 1,
    refund_id           VARCHAR(120),
    refund_amount       DECIMAL(10,2),
    failure_reason      VARCHAR(300),
    raw_response        JSONB,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ptx_order ON payment_transactions(order_id, created_at DESC);
CREATE UNIQUE INDEX uq_ptx_gateway_order ON payment_transactions(gateway, gateway_order_id)
    WHERE gateway_order_id IS NOT NULL;
CREATE INDEX idx_ptx_gateway_payment ON payment_transactions(gateway, gateway_payment_id);

-- Every inbound webhook is stored first; the unique key makes redelivery a no-op,
-- and failed processing is retried by a background job with exponential backoff.
CREATE TABLE webhook_events (
    id               BIGSERIAL PRIMARY KEY,
    gateway          VARCHAR(20)  NOT NULL,
    event_id         VARCHAR(200) NOT NULL,
    event_type       VARCHAR(100) NOT NULL,
    payload          TEXT         NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'RECEIVED', -- RECEIVED, PROCESSED, FAILED, IGNORED, DEAD
    attempts         INT          NOT NULL DEFAULT 0,
    last_error       VARCHAR(500),
    received_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at     TIMESTAMPTZ,
    next_attempt_at  TIMESTAMPTZ,
    CONSTRAINT uq_webhook_event UNIQUE (gateway, event_id)
);
CREATE INDEX idx_webhook_retry ON webhook_events(status, next_attempt_at);

-- Client-supplied Idempotency-Key on POST /checkout prevents double orders on retries.
CREATE TABLE idempotency_keys (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idem_key      VARCHAR(100) NOT NULL,
    request_hash  VARCHAR(64) NOT NULL,
    order_id      BIGINT      REFERENCES orders(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_idempotency UNIQUE (user_id, idem_key)
);

ALTER TABLE orders ADD COLUMN payment_reference      VARCHAR(120);
ALTER TABLE orders ADD COLUMN refund_status          VARCHAR(20);
ALTER TABLE orders ADD COLUMN delivery_landmark      VARCHAR(200);
ALTER TABLE orders ADD COLUMN delivery_contact_name  VARCHAR(100);
ALTER TABLE orders ADD COLUMN delivery_contact_phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN rider_location_at      TIMESTAMPTZ;
CREATE INDEX idx_orders_payment_reference ON orders(payment_reference);
CREATE INDEX idx_orders_agent_status ON orders(delivery_agent_id, status);

-- ---------- Structured addresses ----------
ALTER TABLE addresses ADD COLUMN contact_name      VARCHAR(100);
ALTER TABLE addresses ADD COLUMN contact_phone     VARCHAR(20);
ALTER TABLE addresses ADD COLUMN locality          VARCHAR(120);
ALTER TABLE addresses ADD COLUMN landmark          VARCHAR(200);
ALTER TABLE addresses ADD COLUMN state             VARCHAR(80);
ALTER TABLE addresses ADD COLUMN formatted_address TEXT;
ALTER TABLE addresses ADD COLUMN geocode_source    VARCHAR(30);
ALTER TABLE addresses ADD COLUMN place_id          VARCHAR(300);

-- ---------- Product images ----------
ALTER TABLE products ADD COLUMN image_alt        VARCHAR(250);
ALTER TABLE products ADD COLUMN image_width      INT;
ALTER TABLE products ADD COLUMN image_height     INT;
ALTER TABLE products ADD COLUMN image_updated_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN image_url_b      TEXT;   -- optional A/B variant

UPDATE products SET image_alt = left(title || ' – ' || unit_quantity, 250) WHERE image_alt IS NULL;

CREATE TABLE image_experiment_stats (
    product_id   BIGINT  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant      CHAR(1) NOT NULL CHECK (variant IN ('A', 'B')),
    impressions  BIGINT  NOT NULL DEFAULT 0,
    add_to_carts BIGINT  NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, variant)
);
