-- Andhra Pradesh hubs so shoppers in Vijayawada / Guntur are served locally.
INSERT INTO dark_stores (store_code, name, address, city, pincode, latitude, longitude, is_active) VALUES
('VJA-BNZ-01', 'Benz Circle Hub', 'MG Road, near Benz Circle', 'Vijayawada', '520010', 16.4997, 80.6560, TRUE),
('VJA-GVP-02', 'Governorpet Hub', 'Eluru Road, Governorpet', 'Vijayawada', '520002', 16.5143, 80.6280, TRUE),
('GNT-BRN-01', 'Brodipet Hub', '4th Line, Brodipet', 'Guntur', '522002', 16.3008, 80.4428, TRUE);

-- Same catalog & prices as Koramangala; every product gets its own random stock limit per store
-- (~5% sold out, ~15% low stock, the rest 15-120 units).
INSERT INTO store_inventories (dark_store_id, product_id, stock_quantity, sale_price, is_available)
SELECT ds.id,
       si.product_id,
       CASE WHEN x.r < 0.05 THEN 0
            WHEN x.r < 0.20 THEN 1 + floor(random() * 9)::int
            ELSE 15 + floor(random() * 106)::int END,
       si.sale_price,
       TRUE
FROM dark_stores ds
CROSS JOIN (SELECT product_id, sale_price FROM store_inventories
            WHERE dark_store_id = (SELECT id FROM dark_stores WHERE store_code = 'BLR-KOR-01')) si
CROSS JOIN LATERAL (SELECT random() + 0 * ds.id + 0 * si.product_id AS r) x
WHERE ds.store_code IN ('VJA-BNZ-01', 'VJA-GVP-02', 'GNT-BRN-01');
