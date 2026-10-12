<div align="center">

# 🛒 QuickCart

### Hyperlocal 10-minute grocery delivery — full-stack quick-commerce platform

Shoppers are matched to their nearest **dark store**, see that store's live prices and stock, pay with **UPI, cards or cash**, and watch their rider arrive on a **live map**. Riders share GPS from a phone web app; store teams run the whole operation from a real-time **control tower**.

[![CI](https://github.com/dheerajdonepudi14/QuickCart/actions/workflows/ci.yml/badge.svg)](https://github.com/dheerajdonepudi14/QuickCart/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-6DB33F?logo=springboot&logoColor=white)
![Java](https://img.shields.io/badge/Java-ED8B00?logo=openjdk&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?logo=docker&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<img src="docs/screenshots/00-overview.png" alt="QuickCart storefront with real produce photos and the live order-tracking screen on a phone" width="100%">

[Features](#-features) · [Screenshots](#-screenshots) · [Architecture](#-architecture) · [Tech stack](#-tech-stack) · [Getting started](#-getting-started) · [Configuration](#-configuration) · [API](#-api) · [Docs](docs/ARCHITECTURE.md)

</div>

---

## ✨ Features

<table>
<tr>
<td width="33%" valign="top">

### 🛍️ Shopper
- Nearest dark store by GPS, pincode or store picker
- Per-store prices, stock left and "only N left" badges
- Instant search suggestions, categories, product pages
- Server-quoted cart: coupons, free-delivery bar, fees
- **Address autocomplete**, map pin, landmark & contact
- **UPI** (Google Pay / PhonePe / Paytm intents + QR), **Razorpay**, **PhonePe**, Stripe, cash on delivery
- 10-minute stock hold with countdown
- **Live tracking** with ETA, polling fallback and stale-GPS warning
- Order history, re-order, cancel with automatic refund

</td>
<td width="33%" valign="top">

### 🛵 Delivery partner
- Mobile web app at `/rider`
- Assigned orders with address, landmark and call button
- **Share live location** (GPS every ~5 s)
- One-tap Navigate (Google Maps) and *Mark delivered*
- Privacy by design: customers see only the rider's first name; coordinates are wiped on delivery

### 🔐 Accounts
- Email/password with HttpOnly JWT cookies + rotating refresh tokens
- Google & GitHub sign-in (OAuth2)
- Role-based access: customer · rider · store admin

</td>
<td width="33%" valign="top">

### 🏬 Store admin
- Real-time **control tower** (new → packing → on the road) on a fleet map
- Verify / reject UPI payments by UTR
- Assign riders, cancel with refund
- **Inventory** editor with low/out-of-stock filters and alerts
- **Analytics**: revenue, orders, AOV, top SKUs
- Users panel (logins, orders, spend)
- **Product image manager**: upload, alt text, CDN storage, **A/B test** two photos and promote the winner

### ⚙️ Platform
- Idempotent checkout, webhook inbox with retries, gateway reconciliation
- Prometheus metrics + Grafana dashboard, Slack alerts
- Postman collection, Swagger UI, CI pipeline

</td>
</tr>
</table>

---

## 📸 Screenshots

> Captured from a local run with demo data. Map tiles load from OpenStreetMap at runtime and were not available in the capture environment, so map backgrounds appear blank here.

### Storefront

| Home | Fresh produce (real product photos) |
|:---:|:---:|
| <img src="docs/screenshots/03-home.png" alt="Home page" width="420"> | <img src="docs/screenshots/04-browse-fruits.png" alt="Fruits and vegetables category" width="420"> |
| **Product page** | **Instant search** |
| <img src="docs/screenshots/05-product.png" alt="Product detail page" width="420"> | <img src="docs/screenshots/06-search-suggest.png" alt="Search suggestions" width="420"> |
| **Sign in** (demo accounts, Google & GitHub) | **Choose your dark store** |
| <img src="docs/screenshots/01-login.png" alt="Sign-in page" width="420"> | <img src="docs/screenshots/02-store-picker.png" alt="Delivery location picker" width="420"> |

### Cart, checkout & payments

| Cart with coupons | Checkout |
|:---:|:---:|
| <img src="docs/screenshots/07-cart.png" alt="Shopping cart" width="420"> | <img src="docs/screenshots/08-checkout.png" alt="Checkout page" width="420"> |
| **Address autocomplete** | **Payment methods** |
| <img src="docs/screenshots/09-address-autocomplete.png" alt="Address autocomplete" width="420"> | <img src="docs/screenshots/11-payment-methods.png" alt="Payment methods" width="420"> |
| **UPI QR + 10-minute stock hold** | **UTR submitted, awaiting verification** |
| <img src="docs/screenshots/12-upi-qr.png" alt="UPI QR code" width="420"> | <img src="docs/screenshots/13-upi-utr-submitted.png" alt="Verifying UPI payment" width="420"> |

### Live tracking & rider app

| Live tracking | Stale-location warning | Phone view | Rider app (sharing GPS) |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/14-tracking.png" alt="Order tracking" width="260"> | <img src="docs/screenshots/15-tracking-stale.png" alt="Stale GPS warning" width="260"> | <img src="docs/screenshots/17-tracking-mobile.png" alt="Tracking on a phone" width="130"> | <img src="docs/screenshots/19-rider-sharing.png" alt="Rider app" width="130"> |

### Store admin

| Control tower | UPI payment verified |
|:---:|:---:|
| <img src="docs/screenshots/20-admin-control-tower.png" alt="Control tower" width="420"> | <img src="docs/screenshots/20b-admin-upi-verified.png" alt="UPI verified" width="420"> |
| **Inventory** | **Analytics** |
| <img src="docs/screenshots/21-admin-inventory.png" alt="Inventory editor" width="420"> | <img src="docs/screenshots/22-admin-analytics.png" alt="Analytics" width="420"> |
| **Product images** | **A/B photo test** |
| <img src="docs/screenshots/24-admin-images.png" alt="Product image manager" width="420"> | <img src="docs/screenshots/25-admin-image-ab-test.png" alt="A/B test results" width="420"> |

<details>
<summary>More screenshots</summary>

| Order history | Address form with map pin | Users |
|:---:|:---:|:---:|
| <img src="docs/screenshots/16-my-orders.png" width="280"> | <img src="docs/screenshots/10-address-form.png" width="280"> | <img src="docs/screenshots/23-admin-users.png" width="280"> |
| **Rider — assigned orders** | | |
| <img src="docs/screenshots/18-rider-app.png" width="140"> | | |

</details>

---

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph Clients
        S["🛒 Shopper"]
        R["🛵 Rider"]
        A["🏬 Store admin"]
    end
    subgraph FE["Next.js · :3000"]
        UI["App Router UI<br/>Tailwind · Zustand · TanStack Query"]
        IMG["next/image<br/>AVIF / WebP"]
    end
    subgraph BE["Spring Boot · :8080"]
        API["REST /api/v1<br/>JWT cookies · OAuth2 · rate limit"]
        WS["STOMP /ws-tracker"]
        SVC["Services<br/>orders · inventory · payments · geo · images"]
        JOB["Jobs<br/>hold expiry · webhook retry"]
    end
    DB[("PostgreSQL<br/>Flyway V1–V6")]
    OBJ[("Supabase / S3<br/>+ CDN")]
    PAY["Razorpay · PhonePe<br/>UPI · Stripe"]
    GEO["Google Places<br/>or OSM Photon / Nominatim"]
    OPS["Prometheus · Grafana<br/>Slack alerts"]

    S & R & A --> UI
    UI -->|HTTPS + HttpOnly cookies| API
    UI <-->|live updates| WS
    UI --> IMG --> OBJ
    API --> SVC
    WS --> SVC
    JOB --> SVC
    SVC --> DB
    SVC --> OBJ
    SVC <--> PAY
    PAY -->|signed webhooks| API
    SVC --> GEO
    SVC --> OPS
```

Deeper dives — request path, payment and tracking sequence diagrams, order state machine, ER diagram, image pipeline and reliability patterns — are in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## 🧰 Tech stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js (App Router), React, TypeScript (strict), Tailwind CSS, Zustand, TanStack Query, React Hook Form + Zod, Recharts, Leaflet, STOMP.js + SockJS, `next/image` + sharp |
| **Backend** | Java, Spring Boot (Web, Security, Data JPA, Validation, WebSocket, OAuth2 Client, Cache), JJWT, Caffeine, Micrometer, springdoc-openapi, AWS SDK (S3), TwelveMonkeys ImageIO |
| **Database** | PostgreSQL, Flyway migrations, row-level locking for stock |
| **Payments** | Razorpay Orders + Checkout, PhonePe Payment Gateway, direct UPI intents/QR, Stripe PaymentIntents |
| **Maps & geo** | Google Places (New) & Geocoding, or free OpenStreetMap (Photon, Nominatim), OSRM routing, Leaflet |
| **Storage** | Supabase Storage, any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO) or local disk, optional CDN |
| **DevOps** | Docker & Docker Compose, GitHub Actions, Prometheus, Grafana, Slack webhooks, Postman |

---

## 📁 Project structure

```text
QuickCart/
├── backend/                         Spring Boot API
│   ├── src/main/java/com/quickcommerce/
│   │   ├── config/                  security, CORS, WebSocket, typed properties
│   │   ├── controller/              REST controllers (/api/v1/…)
│   │   ├── service/                 orders, inventory, pricing, catalog, admin, stats
│   │   ├── payment/                 Razorpay, PhonePe, UPI, webhook inbox, refunds
│   │   ├── geo/                     autocomplete & geocoding (Google or OSM)
│   │   ├── media/                   image processing + Supabase / S3 / local storage
│   │   ├── websocket/               STOMP auth & live tracking
│   │   ├── security/                JWT, cookies, OAuth2, rate limiting
│   │   ├── entity/ · repository/ · dto/
│   │   └── observability/ · integration/
│   ├── src/main/resources/db/migration/   Flyway V1 … V6
│   └── Dockerfile
├── frontend/                        Next.js storefront, rider app & admin
│   ├── src/app/                     routes: /, /browse, /product, /cart, /checkout,
│   │                                /orders/[id]/track, /rider, /admin/dashboard, …
│   ├── src/components/              UI by feature (checkout, maps, admin, product…)
│   ├── src/lib/ · src/store/        API client, STOMP client, Zustand stores
│   ├── public/products/             real product photography (see Credits)
│   └── Dockerfile
├── monitoring/                      Prometheus config + Grafana dashboard
├── postman/                         API collection + local environment
├── docs/                            architecture docs & screenshots
├── tools/                           catalogue seed generator
├── docker-compose.yml
└── .env.example                     every setting, documented
```

---

## 🚀 Getting started

### Prerequisites

- **Docker Desktop** (or Docker Engine with Compose) — that's all you need for the quick start.
- For local development without Docker: Java (JDK), Maven, Node.js and PostgreSQL.

### Quick start (Docker)

```bash
git clone https://github.com/dheerajdonepudi14/QuickCart.git
cd QuickCart
cp .env.example .env          # optional — every integration is off by default
docker compose up --build
```

| Service | URL |
|---|---|
| Storefront | http://localhost:3000 |
| Rider app | http://localhost:3000/rider |
| Admin dashboard | http://localhost:3000/admin/dashboard |
| REST API | http://localhost:8080/api/v1 |
| Swagger UI | http://localhost:8080/swagger-ui.html |

Add `--profile monitoring` to also start **Prometheus** (:9090) and **Grafana** (:3001, `admin`/`admin`).

With an empty `.env` the app runs fully: cash on delivery and a demo payment gateway are available, addresses use free OpenStreetMap services, and photos are stored on local disk.

### Demo accounts

Created automatically on first start (for local/demo use — change or remove them in production):

| Role | Email | Password |
|---|---|---|
| Shopper | `shopper@quickcart.dev` | `Shopper@123` |
| Store admin (all stores) | `admin@quickcart.dev` | `Admin@123` |
| Store manager | `manager.blr-kor-01@quickcart.dev` (one per store) | `Manager@123` |
| Rider | `rider1.blr-kor-01@quickcart.dev` | `Rider@123` |

Coupons: `WELCOME50` · `FLAT75` · `FRESH20` · `FARM100`. Delivery is free above ₹199; the serviceable radius is 12 km.

### Try the full flow

1. Open the storefront and pick **Koramangala Hub** (or allow location access).
2. Add a few fruits & vegetables, apply `FRESH20`, and check out as the shopper.
3. Pay with **Demo pay → simulate success** (or UPI / Razorpay test mode if configured).
4. Watch the order on `/orders/{id}/track`. With `AUTO_PROGRESS=true` it is packed and dispatched automatically.
5. In a private window, sign in as the admin to see it live in the control tower — or as the rider and press **Share live location** on a phone.

### Local development (without Docker)

```bash
# 1. Database
docker compose up -d postgres

# 2. Backend — Flyway creates the schema and seeds 10 stores and 216 products
cd backend
mvn spring-boot:run

# 3. Frontend
cd frontend
cp .env.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

---

## 🔧 Configuration

All settings live in a single `.env` file next to `docker-compose.yml`. **[`.env.example`](.env.example)** documents every option; nothing is required to boot.

| Feature | Variables | Notes |
|---|---|---|
| Google / GitHub sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Redirect URI: `http://localhost:8080/login/oauth2/code/{google\|github}` |
| Razorpay (UPI, cards, netbanking) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Use Test Mode keys first |
| PhonePe | `PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_SECRET`, `PHONEPE_CLIENT_VERSION`, `PHONEPE_ENV`, `PHONEPE_WEBHOOK_USERNAME`, `PHONEPE_WEBHOOK_PASSWORD` | `PHONEPE_ENV=SANDBOX` or `PRODUCTION` |
| Direct UPI | `UPI_VPA`, `UPI_PAYEE_NAME`, `UPI_SANDBOX_AUTO_CONFIRM` | Set auto-confirm to `false` in production |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` | International cards |
| Image storage & CDN | `STORAGE_PROVIDER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `S3_*`, `IMAGE_CDN_BASE_URL` | `auto` picks Supabase → S3 → local disk |
| Address autocomplete | `GOOGLE_MAPS_API_KEY`, `GEO_CONTACT_EMAIL` | Blank key = free OpenStreetMap |
| Alerts | `SLACK_WEBHOOK_URL` | Orders, low stock, payment failures |
| Storefront contact | `SUPPORT_PHONE`, `SUPPORT_EMAIL` | Shown in the header, footer and sign-in page |
| Production | `JWT_SECRET`, `COOKIE_SECURE`, `FRONTEND_URL`, `CORS_ORIGINS`, `PUBLIC_API_URL`, `DB_URL` | Always set a new `JWT_SECRET` |

### Payment webhooks

Register these URLs in each gateway dashboard (use an ngrok / Cloudflare tunnel when testing locally):

| Gateway | Webhook URL |
|---|---|
| Razorpay | `https://<your-api>/api/v1/payments/razorpay/webhook` — events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed` |
| PhonePe | `https://<your-api>/api/v1/payments/phonepe/webhook` — with the username/password from `.env` |
| Stripe | `https://<your-api>/api/v1/payments/stripe/webhook` |

---

## 📡 API

Interactive docs are served at **`/swagger-ui.html`**, and a ready-to-run **Postman collection** is in [`postman/`](postman) (import both files, run *Login as shopper* first — auth is cookie-based).

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh-token` · `POST /auth/logout` · `GET /auth/me` · `GET /auth/providers` · `GET /auth/ws-token` |
| Stores | `GET /stores` · `GET /stores/nearest?lat&lng` · `GET /stores/by-pincode/{pincode}` |
| Catalog | `GET /catalog/categories` · `GET /catalog/stores/{id}/products` · `…/products/{productId}` · `…/suggest?q` · `…/top-savers` |
| Addresses & geo | `GET/POST /me/addresses` · `DELETE /me/addresses/{id}` · `GET /geo/autocomplete` · `GET /geo/place/{id}` · `GET /geo/reverse` · `GET /geo/geocode` |
| Checkout | `POST /checkout/quote` · `GET /checkout/coupons` · `POST /checkout` (`Idempotency-Key` header) |
| Payments | `GET /payments/config` · `POST /payments/{orderId}/session` · `GET /payments/{orderId}/status` · `POST /payments/razorpay/{orderId}/verify` · `POST /payments/upi/{orderId}/submitted` · webhooks for Razorpay, PhonePe, Stripe |
| Orders & tracking | `GET /orders` · `GET /orders/{id}` · `GET /orders/{id}/tracking` · `POST /orders/{id}/cancel` |
| Rider | `GET /delivery/orders` · `POST /delivery/orders/{id}/location` · `POST /delivery/orders/{id}/delivered` |
| Admin | stores, live/history orders, actions (`pack`, `assign`, `deliver`, `cancel`, `verify-payment`, `reject-payment`), inventory, analytics, users, product images & A/B promote |
| Realtime (STOMP) | `/ws-tracker` → `/topic/orders/{id}`, `/topic/orders/{id}/tracking`, `/topic/stores/{id}/orders`, `/topic/stores/{id}/alerts` |

All REST paths are prefixed with `/api/v1`.

---

## 🧪 Testing & quality

```bash
cd backend  && mvn verify            # unit tests (payment signatures, image processing) + build
cd frontend && npm run type-check    # strict TypeScript
cd frontend && npm run build         # production build
```

GitHub Actions ([`ci.yml`](.github/workflows/ci.yml)) runs on every push and pull request:

1. Backend build and tests.
2. Frontend type-check and production build.
3. All Flyway migrations applied to a real PostgreSQL database.
4. Docker images for both apps.

---

## 🔒 Security

- No secrets are committed: configuration comes from `.env` (git-ignored), and [`.env.example`](.env.example) contains placeholders only.
- Access and refresh tokens live in HttpOnly cookies, and refresh tokens are stored hashed and rotated on every use.
- Payment webhooks are signature-verified, de-duplicated and processed exactly once.
- Login and API rate limiting, role-based authorisation on every REST route and WebSocket subscription.
- The demo accounts and the default `JWT_SECRET` are for local use only. Set your own values before deploying.

---

## 🙏 Credits

- Product photos for fresh produce come from the [GroceryStoreDataset](https://github.com/marcusklasson/GroceryStoreDataset) by Marcus Klasson (MIT License; see [`frontend/public/products/LICENSE-images.txt`](frontend/public/products/LICENSE-images.txt)). Other products use illustrated placeholders until a photo is uploaded from the admin.
- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, geocoding by Photon & Nominatim, routing by OSRM.

---

## 📄 License

Released under the [MIT License](LICENSE).

## 👤 Author

**Dheeraj Donepudi** · GitHub [@dheerajdonepudi14](https://github.com/dheerajdonepudi14)
