# QuickCart — Hyperlocal 10-minute Commerce (Zepto / Blinkit style)

A full-stack quick-commerce platform: shoppers are mapped to the nearest **dark store**, see that store's live
stock and prices, check out with a **10-minute stock reservation**, pay (Stripe / mock UPI / COD) and watch the
rider move on a **live tracking map** over WebSockets. Store admins run a real-time **control tower**, edit
**inventory**, get **low-stock alerts** and read **analytics**.

```
quickcart/
├── backend/     Spring Boot 3.3 · Java 17 · Security 6 · JPA/PostgreSQL · Flyway · STOMP/SockJS · Stripe · springdoc
├── frontend/    Next.js 14 (App Router) · TS strict · Tailwind · Zustand · TanStack Query · RHF + Zod · Recharts · stompjs
├── tools/       generate_seed.py → regenerates backend/.../V2__seed_catalog.sql
└── docker-compose.yml
```

## Quick start (Docker)

```bash
docker compose up --build
# storefront  http://localhost:3000
# admin       http://localhost:3000/admin/dashboard
# API docs    http://localhost:8081/swagger-ui.html
```

## Local development

```bash
# 1. Database
docker compose up -d postgres

# 2. Backend (Flyway creates the schema + seeds 7 stores, 26 categories, 192 products, 1344 inventory rows)
cd backend
mvn spring-boot:run

# 3. Frontend
cd frontend
cp .env.example .env.local        # NEXT_PUBLIC_API_URL=http://localhost:8081
npm install
npm run dev                       # http://localhost:3000
```

## Seeded accounts (created on first boot)

| Role | Email | Password |
|---|---|---|
| Customer | shopper@quickcart.dev | Shopper@123 |
| Store admin (all stores) | admin@quickcart.dev | Admin@123 |
| Store manager | manager.blr-kor-01@quickcart.dev (one per store code) | Manager@123 |
| Delivery partner | rider1.blr-kor-01@quickcart.dev / rider2.… | Rider@123 |

Coupons: `WELCOME50` (50% up to ₹100, min ₹199) · `FLAT75` (min ₹499) · `FRESH20` (20% up to ₹60, min ₹299) · `FARM100` (₹100 off, min ₹999).
Fees: free delivery ≥ ₹199 else ₹25, +₹15 beyond 5 km, ₹4 handling. Serviceable radius 12 km.

## What's new in v3

| Area | What you get | Config |
|---|---|---|
| Payments | Razorpay (cards/UPI/netbanking), PhonePe PG v2, direct UPI (QR + GPay/PhonePe/Paytm intents + UTR, admin verification), Stripe, COD. Sandbox/live switch, signed webhooks stored in an inbox (dedupe + exponential retry, DEAD → Slack), `Idempotency-Key` on checkout, gateway reconciliation before stock release, automatic refunds on cancel | `RAZORPAY_*`, `PHONEPE_*`, `UPI_*`, `STRIPE_*` |
| Images | Supabase Storage / S3 / local disk with optional CDN; server resize (≤1600px) + EXIF strip + content-hash keys; AVIF/WebP + srcset + lazy loading via next/image; alt text; A/B image variants with impressions/add-to-cart stats and one-click promote | `STORAGE_PROVIDER`, `SUPABASE_*`, `IMAGE_CDN_BASE_URL` |
| Addresses | Autocomplete (Google Places New, or free Photon), server-side geocoding (Google or Nominatim), map pin, landmark + contact, pincode warning, serviceability check that switches to the nearest store | `GOOGLE_MAPS_API_KEY` (optional) |
| Tracking | Rider web app at `/rider` sharing GPS every ~5 s, WebSocket + 10 s polling fallback, stale-location banner after 60 s, rider first name only, coordinates wiped on delivery | — |
| Ops | `X-Request-Id` on every response and log line, Prometheus metrics (`/actuator/prometheus`), Grafana dashboard *QuickCart Ops*, Slack alerts for orders / low stock / payment failures | `SLACK_WEBHOOK_URL` |

Webhook URLs to register (use an ngrok/cloudflared tunnel for local testing):
`/api/v1/payments/razorpay/webhook` · `/api/v1/payments/phonepe/webhook` · `/api/v1/payments/stripe/webhook`.
Any gateway without keys is simply hidden at checkout, so the app runs with an empty `.env` (COD + mock online pay).

Monitoring: `docker compose --profile monitoring up --build` → Prometheus :9090, Grafana :3001 (admin/admin).

**Connected tools:** Postman collection *QuickCart API* + environment *QuickCart Local* (also in `postman/`),
Asana project *QuickCart Launch*, Notion page *QuickCart v3 — Architecture, Setup & Runbook*,
Supabase project *quickcart* (ap-south-1) with public bucket `product-images`.

## What's new in v2

- **Real product photos** — every product has an image slot. Admin → **Product images** tab lets you upload a photo
  (stored in the `uploads` Docker volume, served publicly at `http://<backend>/uploads/products/...`), paste any https
  URL, or pick a free photo from Wikimedia Commons / Wikipedia / Open Food Facts. **Auto-match missing images** finds a
  photo for every product still showing an emoji; review the grid, untick bad matches and save them in one click.
  Commons/Wikipedia photos are CC-licensed and Open Food Facts is ODbL — credit them or use your own photos for a commercial launch.
- **Maps (free, no API key)** — OpenStreetMap data with CARTO Voyager tiles (Leaflet), OSRM road routing and Nominatim
  address search. Checkout has a search + drag-the-pin address picker; the order tracking page shows the store, your
  door, the road route and the rider moving along it; the admin control tower has a live fleet map. The backend
  simulator now drives riders along the same OSRM road route (falls back to a straight line if OSRM is unreachable).
- **Live numbers** — `GET /api/v1/stats` (public): registered users, users logged in now (active sessions), logins
  today, products, units sold, units left, orders delivered. Shown on the home page and the admin header.
  Admin → **Users** lists every account with last login, login count, orders and spend (platform admins only).
- **Stock limits** — each product has its own random stock limit per dark store (seeded 0 / 1–9 / 15–120). Every
  sale lowers "left" and raises "sold"; cards show `🔥 N sold · M left`, and at 0 the product flips to **Out of Stock**
  and can't be added. Cancelled/expired orders put units back.
- **Contact** — +91 81439 65686 · dheerajdonepudi18@gmail.com in the top bar, footer and sign-in page
  (edit `frontend/src/lib/site.ts`).

## Google / GitHub sign-in

Put your OAuth credentials in `.env` next to `docker-compose.yml` (already filled for Google; add the GitHub secret and
uncomment those lines), then `docker compose up -d backend`. Check `http://localhost:8081/api/v1/auth/providers`.
Redirect URIs: `http://localhost:8081/login/oauth2/code/google` and `http://localhost:8081/login/oauth2/code/github`.
When you deploy, add the production URLs to both consoles and set `FRONTEND_URL`, `CORS_ORIGINS`,
`NEXT_PUBLIC_API_URL` and `COOKIE_SECURE=true`.

## Demo flow

1. Open the storefront; pick a location (pincode `560034` = Koramangala, or "Use my current location").
2. Add items → cart drawer shows a live server quote (stock-checked, coupons, dynamic fees).
3. Sign in as the shopper → checkout → pick **Mock Pay** → *simulate success*.
4. You land on `/orders/{id}/track`. With `AUTO_PROGRESS=true` the order moves to *Packing* after ~20 s,
   a rider is auto-assigned, and the 🛵 moves every 3 s until it's delivered.
5. In another browser (or incognito) sign in as `admin@quickcart.dev` → `/admin/dashboard`: the order appears live
   in the control tower. Set `AUTO_PROGRESS=false` to drive **Mark packed → Assign → Delivered** by hand.
6. Buy a SKU down below 10 units to see the low-stock alert fire in the dashboard bell.

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | backend | PostgreSQL (defaults: localhost/quickcart) |
| `JWT_SECRET` | backend | Base64 HS256 key (≥256 bit). **Change in production.** |
| `COOKIE_SECURE` | backend | `true` behind HTTPS (switches cookies to `SameSite=None; Secure`) |
| `FRONTEND_URL`, `CORS_ORIGINS` | backend | OAuth redirect target & allowed origins |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | backend | Enables card payments |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | backend | Enables social login (redirect URI `http://localhost:8081/login/oauth2/code/{google|github}`) |
| `AUTO_PROGRESS` | backend | Simulate packing & dispatch automatically |
| `NEXT_PUBLIC_API_URL` | frontend | Backend base URL (REST + `/ws-tracker`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | frontend | Shows the card option at checkout |

### Stripe (test mode)

```bash
stripe listen --forward-to localhost:8081/api/v1/payments/stripe/webhook
# copy the whsec_… into STRIPE_WEBHOOK_SECRET, restart backend
```
Test card `4242 4242 4242 4242`, any future expiry, any CVC. The browser also calls
`/api/v1/payments/stripe/{id}/verify` after confirmation, so orders confirm even before the webhook lands.
Payment confirmation is idempotent; a payment arriving after the reservation expired re-reserves stock or refunds.

## Architecture notes

- **Auth** — access token (15 min, cookie `qc_access`) + rotating refresh token (14 days, `qc_refresh`, path `/api/v1/auth`,
  stored hashed). The frontend's `api.ts` retries once after a single-flight `POST /auth/refresh-token` on 401.
- **Stock integrity** — checkout locks `store_inventories` rows with `PESSIMISTIC_WRITE` in product-id order (no deadlocks),
  deducts all-or-nothing, and sets `reservation_expires_at = now + 10 min`. `ReservationExpiryJob` (every 30 s) releases
  stock of unpaid orders. Cancels/refunds return stock.
- **Realtime** — STOMP over SockJS at `/ws-tracker`; the handshake authenticates from the cookie.
  Topics: `/topic/orders/{id}` (status), `/topic/orders/{id}/tracking` (GPS), `/topic/stores/{id}/orders`,
  `/topic/stores/{id}/alerts`. Riders publish to `/app/orders/{id}/location` (or `POST /api/v1/delivery/orders/{id}/location`).
  Messages are sent only after the DB transaction commits. Subscriptions are authorised per order/store.
- **Order state machine** — `CREATED → ORDER_PLACED → PACKING_IN_PROGRESS → OUT_FOR_DELIVERY → DELIVERED`,
  with `PAYMENT_FAILED`, `EXPIRED`, `CANCELLED` exits; illegal transitions return 409. Every transition is written to
  `order_status_history`.
- **Catalog images** — `image_url` holds either a real URL or an emoji. The UI renders emoji as illustrated packshots,
  so the app runs with no image hosting; put real URLs in the DB to switch to photos.
- **Scaling** — the in-memory rate limiter and simple STOMP broker are single-node. For multiple backend instances,
  move rate limits to Redis and switch to a STOMP broker relay (RabbitMQ/ActiveMQ); the `redis` compose profile is there for that.

## Catalog

26 categories across 5 departments — Grocery & Kitchen (fruits & vegetables, dairy, grains & oils, masala & ghee,
meat & seafood, breakfast, frozen), Snacks & Drinks (snacks, sweets, cold drinks & juices, tea & coffee,
**brewery: kombucha, cold brew, 0.0% craft beer, mixers, home-brew kits**), Beauty & Personal Care (skin, hair,
men's grooming, bath & body, oral care, makeup), Household & Lifestyle (baby, health, cleaning, crockery, pet care)
and **Farm & Garden** (seeds & saplings, fertilizers & plant protection, farm tools).
Regenerate with `python3 tools/generate_seed.py`.
