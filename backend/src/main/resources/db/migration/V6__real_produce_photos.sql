-- V6: real product photography for fresh produce + 24 more fruits & vegetables.
-- Photos live in the frontend bundle (frontend/public/products/*.jpg, MIT-licensed GroceryStoreDataset),
-- so they work offline and are optimised to AVIF/WebP by next/image like any other image.
-- Only rows still showing the seed emoji are touched, so photos uploaded by an admin are kept.

UPDATE products p SET image_url = v.url, image_alt = v.alt, image_width = 198, image_height = 198, image_updated_at = now()
FROM (VALUES
  (1,  '/products/tomato.jpg',    'Three ripe red tomatoes'),
  (2,  '/products/onion.jpg',     'Whole onions with papery skin'),
  (3,  '/products/potato.jpg',    'Fresh potatoes'),
  (4,  '/products/banana.jpg',    'Bunch of ripe yellow bananas'),
  (5,  '/products/apple-red.jpg', 'Red apple'),
  (7,  '/products/carrot.jpg',    'Fresh orange carrots'),
  (8,  '/products/cucumber.jpg',  'Green cucumber'),
  (10, '/products/pineapple.jpg', 'Whole pineapple'),
  (12, '/products/avocado.jpg',   'Hass avocado')
) AS v(id, url, alt)
WHERE p.id = v.id AND p.image_url !~ '^(https?://|/)';

-- A/B test demo: a second tomato photo competes with the first (Admin → Product images shows the results).
UPDATE products SET image_url_b = '/products/tomato-vine.jpg' WHERE id = 1 AND image_url_b IS NULL;

INSERT INTO products (category_id, title, brand, description, unit_quantity, base_price, image_url, image_alt, image_width, image_height, rating, tags, attributes, is_active)
SELECT c.id, v.title, 'Fresho', 'Fresho ' || v.title || ' (' || v.qty || '). Sourced for your nearest dark store and delivered in minutes.',
       v.qty, v.price, v.url, v.alt, 198, 198, v.rating, v.tags,
       jsonb_build_object('shelfLife', v.shelf, 'countryOfOrigin', 'India', 'veg', true), TRUE
FROM categories c
CROSS JOIN (VALUES
  ('Banganapalli Mango',     '1 kg',           180.00, '/products/mango.jpg',           'Ripe mango',                     4.7, 'fruit,seasonal', '5 days'),
  ('Pomegranate',            '4 pcs (~800 g)', 220.00, '/products/pomegranate.jpg',     'Whole pomegranate',              4.5, 'fruit',          '10 days'),
  ('Kiwi',                   '3 pcs',           99.00, '/products/kiwi.jpg',            'Kiwi fruit, whole and halved',   4.4, 'fruit,exotic',   '7 days'),
  ('Nagpur Orange',          '1 kg',           120.00, '/products/orange.jpg',          'Orange',                         4.5, 'fruit,citrus',   '10 days'),
  ('Papaya',                 '1 pc (~1 kg)',    60.00, '/products/papaya.jpg',          'Papaya, whole and halved',       4.3, 'fruit',          '4 days'),
  ('Watermelon',             '1 pc (~2.5 kg)',  90.00, '/products/watermelon.jpg',      'Watermelon slice',               4.4, 'fruit,summer',   '7 days'),
  ('Muskmelon',              '1 pc (~1 kg)',    70.00, '/products/muskmelon.jpg',       'Muskmelon cut open',             4.2, 'fruit,summer',   '5 days'),
  ('Green Apple',            '4 pcs (~600 g)', 200.00, '/products/apple-green.jpg',     'Green apple',                    4.4, 'fruit,exotic',   '14 days'),
  ('Royal Gala Apple',       '4 pcs (~600 g)', 210.00, '/products/apple-royal-gala.jpg','Royal Gala apple',               4.5, 'fruit,exotic',   '14 days'),
  ('Pear',                   '4 pcs (~500 g)', 160.00, '/products/pear.jpg',            'Green pear',                     4.2, 'fruit',          '7 days'),
  ('Plum',                   '250 g',          120.00, '/products/plum.jpg',            'Red plums',                      4.1, 'fruit,seasonal', '5 days'),
  ('Peach',                  '4 pcs (~400 g)', 150.00, '/products/peach.jpg',           'Ripe peach',                     4.2, 'fruit,seasonal', '5 days'),
  ('Lemon',                  '250 g',           35.00, '/products/lemon.jpg',           'Yellow lemon',                   4.5, 'fruit,citrus',   '14 days'),
  ('Ginger',                 '250 g',           40.00, '/products/ginger.jpg',          'Fresh ginger root',              4.4, 'vegetable',      '21 days'),
  ('Garlic',                 '250 g',           60.00, '/products/garlic.jpg',          'Whole garlic bulb',              4.5, 'vegetable',      '30 days'),
  ('Green Capsicum',         '500 g',           45.00, '/products/capsicum-green.jpg',  'Green capsicum',                 4.3, 'vegetable',      '7 days'),
  ('Red Capsicum',           '250 g',           70.00, '/products/capsicum-red.jpg',    'Red bell pepper',                4.3, 'vegetable,exotic','7 days'),
  ('Yellow Capsicum',        '250 g',           70.00, '/products/capsicum-yellow.jpg', 'Yellow bell pepper',             4.3, 'vegetable,exotic','7 days'),
  ('Sweet Potato',           '500 g',           45.00, '/products/sweet-potato.jpg',    'Sweet potato',                   4.2, 'vegetable',      '21 days'),
  ('Cabbage',                '1 pc (~700 g)',   35.00, '/products/cabbage.jpg',         'Fresh green cabbage',            4.2, 'vegetable',      '7 days'),
  ('Brinjal (Bharta)',       '500 g',           40.00, '/products/brinjal.jpg',         'Purple brinjal',                 4.1, 'vegetable',      '5 days'),
  ('Brown Mushroom',         '200 g',           55.00, '/products/mushroom.jpg',        'Brown cap mushrooms',            4.3, 'vegetable',      '3 days'),
  ('Beetroot',               '500 g',           38.00, '/products/beetroot.jpg',        'Fresh beetroots',                4.2, 'vegetable',      '14 days'),
  ('Green Zucchini',         '500 g',           89.00, '/products/zucchini.jpg',        'Green zucchini',                 4.1, 'vegetable,exotic','7 days')
) AS v(title, qty, price, url, alt, rating, tags, shelf)
WHERE c.slug = 'fruits-vegetables'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.title = v.title AND p.category_id = c.id);

-- Stock every active dark store with the new produce (store-specific price within 85–100% of MRP).
INSERT INTO store_inventories (dark_store_id, product_id, stock_quantity, sale_price, is_available)
SELECT ds.id, p.id,
       20 + floor(random() * 90)::int,
       round(p.base_price * (0.85 + random() * 0.15)),
       TRUE
FROM dark_stores ds
CROSS JOIN products p
JOIN categories c ON c.id = p.category_id AND c.slug = 'fruits-vegetables'
WHERE p.image_url LIKE '/products/%'
ON CONFLICT (dark_store_id, product_id) DO NOTHING;
