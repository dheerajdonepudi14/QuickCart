-- Login tracking for the "users" dashboard
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN login_count  INT NOT NULL DEFAULT 0;
CREATE INDEX idx_users_last_login ON users(last_login_at);

-- Units sold per dark store; stock_quantity is the remaining limit (random per store in the seed)
ALTER TABLE store_inventories ADD COLUMN sold_count INT NOT NULL DEFAULT 0 CHECK (sold_count >= 0);

UPDATE store_inventories si
SET sold_count = s.units
FROM (SELECT o.dark_store_id, oi.product_id, SUM(oi.quantity) AS units
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status NOT IN ('CANCELLED', 'EXPIRED', 'PAYMENT_FAILED')
      GROUP BY o.dark_store_id, oi.product_id) s
WHERE si.dark_store_id = s.dark_store_id AND si.product_id = s.product_id;
