-- =========================================================
-- QuickCart schema : hyperlocal quick-commerce
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Dark stores (micro-warehouses)
CREATE TABLE dark_stores (
    id           BIGSERIAL PRIMARY KEY,
    store_code   VARCHAR(50)  UNIQUE NOT NULL,
    name         VARCHAR(100) NOT NULL,
    address      TEXT         NOT NULL,
    city         VARCHAR(80)  NOT NULL,
    pincode      VARCHAR(10)  NOT NULL,
    latitude     DOUBLE PRECISION NOT NULL,
    longitude    DOUBLE PRECISION NOT NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_dark_stores_pincode ON dark_stores(pincode);

-- 2. Users & auth
CREATE TABLE users (
    id               BIGSERIAL PRIMARY KEY,
    full_name        VARCHAR(100) NOT NULL,
    email            VARCHAR(150) UNIQUE NOT NULL,
    phone_number     VARCHAR(20)  UNIQUE,
    password_hash    VARCHAR(255),
    role             VARCHAR(30)  NOT NULL DEFAULT 'ROLE_CUSTOMER',
    provider         VARCHAR(20)  NOT NULL DEFAULT 'LOCAL',
    store_id         BIGINT REFERENCES dark_stores(id),   -- store admins / delivery partners
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(128) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN   NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE addresses (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label         VARCHAR(30)  NOT NULL DEFAULT 'Home',
    line1         VARCHAR(200) NOT NULL,
    line2         VARCHAR(200),
    city          VARCHAR(80)  NOT NULL,
    pincode       VARCHAR(10)  NOT NULL,
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION,
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Catalog
CREATE TABLE categories (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    slug          VARCHAR(100) UNIQUE NOT NULL,
    image_url     TEXT,
    department    VARCHAR(60)  NOT NULL,
    theme_color   VARCHAR(20)  NOT NULL DEFAULT '#EEF6EE',
    sort_order    INT NOT NULL DEFAULT 0
);

CREATE TABLE products (
    id             BIGSERIAL PRIMARY KEY,
    category_id    BIGINT REFERENCES categories(id) ON DELETE CASCADE,
    title          VARCHAR(200) NOT NULL,
    brand          VARCHAR(100) NOT NULL,
    description    TEXT,
    unit_quantity  VARCHAR(50)  NOT NULL,
    base_price     DECIMAL(10,2) NOT NULL,
    image_url      TEXT NOT NULL,
    rating         DECIMAL(2,1) NOT NULL DEFAULT 4.2,
    tags           TEXT,
    attributes     JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_title_trgm ON products USING gin (title gin_trgm_ops);
CREATE INDEX idx_products_brand_trgm ON products USING gin (brand gin_trgm_ops);

-- 4. Store-specific inventory
CREATE TABLE store_inventories (
    id              BIGSERIAL PRIMARY KEY,
    dark_store_id   BIGINT NOT NULL REFERENCES dark_stores(id) ON DELETE CASCADE,
    product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stock_quantity  INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    sale_price      DECIMAL(10,2) NOT NULL,
    is_available    BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version         BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT unique_store_product UNIQUE (dark_store_id, product_id)
);
CREATE INDEX idx_inventory_store_product ON store_inventories(dark_store_id, product_id);

-- 5. Coupons
CREATE TABLE coupons (
    id               BIGSERIAL PRIMARY KEY,
    code             VARCHAR(30) UNIQUE NOT NULL,
    description      VARCHAR(200) NOT NULL,
    discount_type    VARCHAR(20) NOT NULL,          -- PERCENTAGE, FLAT
    discount_value   DECIMAL(10,2) NOT NULL,
    min_cart_value   DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_discount     DECIMAL(10,2),
    usage_limit      INT,
    used_count       INT NOT NULL DEFAULT 0,
    expires_at       TIMESTAMPTZ,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. Orders
CREATE TABLE orders (
    id                         BIGSERIAL PRIMARY KEY,
    order_number               VARCHAR(50) UNIQUE NOT NULL,
    user_id                    BIGINT NOT NULL REFERENCES users(id),
    dark_store_id              BIGINT NOT NULL REFERENCES dark_stores(id),
    delivery_agent_id          BIGINT REFERENCES users(id),
    status                     VARCHAR(30) NOT NULL,
    payment_method             VARCHAR(20) NOT NULL,
    subtotal                   DECIMAL(10,2) NOT NULL,
    discount_amount            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    delivery_fee               DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    handling_fee               DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount               DECIMAL(10,2) NOT NULL,
    coupon_code                VARCHAR(30),
    delivery_address           TEXT NOT NULL,
    delivery_latitude          DOUBLE PRECISION,
    delivery_longitude         DOUBLE PRECISION,
    rider_latitude             DOUBLE PRECISION,
    rider_longitude            DOUBLE PRECISION,
    stripe_payment_intent_id   VARCHAR(100),
    reservation_expires_at     TIMESTAMPTZ,
    cancel_reason              VARCHAR(200),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at                    TIMESTAMPTZ,
    delivered_at               TIMESTAMPTZ
);
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_store_status ON orders(dark_store_id, status);
CREATE INDEX idx_orders_reservation ON orders(status, reservation_expires_at);

CREATE TABLE order_items (
    id           BIGSERIAL PRIMARY KEY,
    order_id     BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   BIGINT NOT NULL REFERENCES products(id),
    product_title VARCHAR(200) NOT NULL,
    image_url    TEXT NOT NULL,
    unit_quantity VARCHAR(50) NOT NULL,
    unit_price   DECIMAL(10,2) NOT NULL,
    quantity     INT NOT NULL CHECK (quantity > 0),
    total_price  DECIMAL(10,2) NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE TABLE order_status_history (
    id          BIGSERIAL PRIMARY KEY,
    order_id    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status      VARCHAR(30) NOT NULL,
    note        VARCHAR(200),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_status_history_order ON order_status_history(order_id);

CREATE TABLE newsletter_subscribers (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(150) UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
