# QuickCart — Architecture

This document explains how the pieces of QuickCart fit together: the runtime topology, the data model, and the three flows that matter most (checkout & payment, live tracking, and order lifecycle). All diagrams are [Mermaid](https://mermaid.js.org/) and render directly on GitHub.

- [1. System overview](#1-system-overview)
- [2. Request path & security](#2-request-path--security)
- [3. Checkout & payment flow](#3-checkout--payment-flow)
- [4. Live order tracking](#4-live-order-tracking)
- [5. Order lifecycle](#5-order-lifecycle)
- [6. Data model](#6-data-model)
- [7. Product images pipeline](#7-product-images-pipeline)
- [8. Reliability patterns](#8-reliability-patterns)
- [9. Observability](#9-observability)

---

## 1. System overview

```mermaid
flowchart LR
    subgraph Users
        Shopper["🛒 Shopper<br/>web / mobile"]
        Rider["🛵 Delivery partner<br/>/rider web app"]
        Admin["🏬 Store admin<br/>ops dashboard"]
    end

    subgraph FE["Frontend · Next.js (App Router) · :3000"]
        Pages["Pages & components<br/>React · Tailwind"]
        State["Zustand<br/>cart · location · auth"]
        RQ["TanStack Query<br/>api.ts (cookie auth, auto-refresh)"]
        Stomp["STOMP over SockJS"]
        NImg["next/image<br/>AVIF / WebP · srcset · lazy"]
        Media["/media proxy route"]
    end

    subgraph BE["Backend · Spring Boot · Java · :8080"]
        Sec["Security filter chain<br/>JWT cookie · OAuth2 · CORS · rate limit"]
        REST["REST API /api/v1"]
        WS["WebSocket /ws-tracker<br/>STOMP simple broker"]
        Svc["Domain services<br/>Order · Inventory · Pricing · Payment<br/>Geo · Images · Stats · Alerts"]
        Jobs["Schedulers<br/>reservation expiry · webhook retry<br/>delivery simulation"]
        Cache["Caffeine cache"]
        Metrics["Micrometer → /actuator/prometheus"]
    end

    subgraph Data["Data"]
        PG[("PostgreSQL<br/>Flyway V1–V6")]
        Store[("Object storage<br/>Supabase / S3 / local disk")]
    end

    subgraph Ext["External services (all optional)"]
        RZP["Razorpay<br/>UPI · cards · netbanking"]
        PPE["PhonePe Payment Gateway"]
        STR["Stripe"]
        GEO["Google Places & Geocoding<br/>or Photon + Nominatim (OSM)"]
        OSRM["OSRM routing"]
        OAUTH["Google / GitHub OAuth2"]
        SLACK["Slack webhook"]
        CDN["CDN"]
    end

    Shopper --> Pages
    Rider --> Pages
    Admin --> Pages
    Pages --> State
    Pages --> RQ
    Pages --> Stomp
    Pages --> NImg
    NImg --> Media
    Media --> REST

    RQ -->|HTTPS + HttpOnly cookies| Sec --> REST
    Stomp -->|SockJS + short-lived token| WS
    REST --> Svc
    WS --> Svc
    Jobs --> Svc
    Svc --> Cache
    Svc --> PG
    Svc --> Store
    Store --> CDN
    Svc -->|publish after commit| WS
    Svc --> Metrics

    Svc <-->|orders · verify · refunds| RZP
    Svc <-->|pay · status · refunds| PPE
    Svc <--> STR
    RZP -->|signed webhook| REST
    PPE -->|signed webhook| REST
    STR -->|signed webhook| REST
    Svc --> GEO
    Svc --> OSRM
    Sec <--> OAUTH
    Svc --> SLACK
```

| Layer | Responsibility |
|---|---|
| **Next.js frontend** | Server-renders pages, owns client state (cart, chosen dark store), talks to the API with HttpOnly cookies, subscribes to live updates over STOMP. |
| **Spring Boot API** | Stateless REST + WebSocket. Every order is scoped to a dark store; prices and stock are per-store. |
| **PostgreSQL** | Source of truth, versioned with Flyway. Stock is reserved with row locks (`SELECT … FOR UPDATE`, taken in product-id order so concurrent checkouts can't deadlock). |
| **Object storage** | Product photos (Supabase Storage, any S3-compatible bucket, or local disk), optionally fronted by a CDN. |
| **External services** | Every integration is optional and switched on by environment variables; the app boots with none of them. |

---

## 2. Request path & security

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant N as Next.js
    participant S as Spring Security
    participant C as Controller
    B->>N: GET /checkout
    N-->>B: HTML + JS
    B->>S: POST /api/v1/auth/login {email, password}
    S->>C: (permitAll)
    C-->>B: 200 + Set-Cookie qc_access (15 min) + qc_refresh (14 days, path /api/v1/auth)
    B->>S: GET /api/v1/me/addresses (cookie)
    S->>S: RequestId MDC · rate limit · JWT (newest valid cookie)
    S->>C: authenticated as UserPrincipal(id, role, storeId)
    C-->>B: 200 JSON
    Note over B,S: On 401 the client calls /auth/refresh-token once,<br/>then retries the original request
```

- **Auth** — short-lived access JWT + rotating, hashed refresh token, both in HttpOnly `SameSite` cookies; optional Google/GitHub OAuth2 login.
- **Roles** — `ROLE_CUSTOMER`, `ROLE_DELIVERY_PARTNER`, `ROLE_STORE_ADMIN` (scoped to one store, or all stores when `storeId` is null).
- **WebSockets** — the browser fetches a 2-minute token from `/api/v1/auth/ws-token` before each STOMP `CONNECT`; subscriptions to `/topic/orders/{id}` and `/topic/stores/{id}` are authorised per frame.
- **Webhooks** — signature-verified (HMAC-SHA256 for Razorpay/Stripe, SHA-256 credentials for PhonePe) and excluded from rate limiting.

---

## 3. Checkout & payment flow

```mermaid
sequenceDiagram
    autonumber
    participant U as Shopper (browser)
    participant API as QuickCart API
    participant DB as PostgreSQL
    participant GW as Gateway (Razorpay / PhonePe / UPI)
    participant WS as STOMP broker

    U->>API: POST /checkout/quote (cart, coupon, location)
    API-->>U: prices, fees, stock per line, ETA
    U->>API: POST /checkout  (Idempotency-Key: uuid)
    API->>DB: reserve stock (row locks), order = CREATED, hold 10 min
    API->>GW: create gateway order / payment session
    API-->>U: order + payment session (Razorpay order · PhonePe redirect · UPI QR/intents)
    U->>GW: pays (UPI app, card, netbanking)
    alt client callback
        U->>API: POST /payments/razorpay/{id}/verify (signature)
        API->>API: verify HMAC
    else server webhook (may arrive first, late or twice)
        GW->>API: POST /payments/{gateway}/webhook
        API->>DB: webhook_events (unique gateway+event id) → process once
    end
    API->>DB: order = ORDER_PLACED, payment_transactions = SUCCEEDED
    API->>WS: /topic/orders/{id} + /topic/stores/{storeId}
    Note over API,DB: Before a hold expires the server reconciles with the gateway,<br/>so a delayed webhook can never lose a paid order.
```

| Method | How it works |
|---|---|
| **Razorpay** | Server creates a Razorpay order → Checkout.js (UPI-first) → signature verify + `payment.captured` webhook. Refunds via API. |
| **PhonePe Payment Gateway** | OAuth `O-Bearer` token → `/checkout/v2/pay` redirect → status API + webhook. Refunds via API. |
| **Direct UPI** | `upi://pay` intent links for Google Pay / PhonePe / Paytm plus a QR code; the shopper submits the UTR and the store verifies it in the control tower (auto-confirm in sandbox). |
| **Stripe** | PaymentIntents for international cards. |
| **Cash on delivery** | Order is placed immediately. |

---

## 4. Live order tracking

```mermaid
sequenceDiagram
    autonumber
    participant R as Rider app (/rider)
    participant API as QuickCart API
    participant DB as PostgreSQL
    participant WS as STOMP broker
    participant C as Customer (/orders/{id}/track)

    C->>API: GET /ws-token, then STOMP CONNECT + SUBSCRIBE /topic/orders/{id}
    loop every ~5 s while sharing
        R->>API: POST /delivery/orders/{id}/location {lat, lng}
        API->>DB: rider_latitude/longitude, rider_location_at
        API->>WS: TrackingUpdate {lat, lng, distance, ETA}
        WS-->>C: live marker + ETA
    end
    alt socket drops
        C->>API: GET /orders/{id}/tracking (every 10 s)
    end
    Note over C: Banner if the last GPS fix is older than 60 s
    R->>API: POST /delivery/orders/{id}/delivered
    API->>DB: status DELIVERED, rider coordinates cleared (privacy)
```

Customers only ever see the rider's first name and a "Call support" button — never the rider's phone number.

---

## 5. Order lifecycle

```mermaid
stateDiagram-v2
    [*] --> CREATED: checkout (stock reserved, 10-min hold)
    CREATED --> ORDER_PLACED: payment confirmed / COD
    CREATED --> PAYMENT_FAILED: payment declined or UPI rejected
    CREATED --> EXPIRED: hold elapsed, gateway reconciled
    CREATED --> CANCELLED: shopper cancels
    ORDER_PLACED --> PACKING_IN_PROGRESS: store marks packed
    ORDER_PLACED --> CANCELLED: shopper / store cancels → refund
    PACKING_IN_PROGRESS --> OUT_FOR_DELIVERY: rider assigned
    PACKING_IN_PROGRESS --> CANCELLED: store cancels → refund
    OUT_FOR_DELIVERY --> DELIVERED: rider marks delivered
    PAYMENT_FAILED --> [*]: stock released
    EXPIRED --> [*]: stock released
    CANCELLED --> [*]: stock released (+ refund if paid)
    DELIVERED --> [*]
```

---

## 6. Data model

```mermaid
erDiagram
    DARK_STORES ||--o{ STORE_INVENTORIES : stocks
    CATEGORIES ||--o{ PRODUCTS : groups
    PRODUCTS ||--o{ STORE_INVENTORIES : "priced per store"
    DARK_STORES ||--o{ USERS : "staff & riders"
    USERS ||--o{ REFRESH_TOKENS : sessions
    USERS ||--o{ ADDRESSES : saves
    USERS ||--o{ ORDERS : places
    DARK_STORES ||--o{ ORDERS : fulfils
    USERS ||--o{ ORDERS : "delivers (rider)"
    ORDERS ||--|{ ORDER_ITEMS : contains
    PRODUCTS ||--o{ ORDER_ITEMS : "sold as"
    ORDERS ||--o{ ORDER_STATUS_HISTORY : timeline
    ORDERS ||--o{ PAYMENT_TRANSACTIONS : "payment attempts"
    PRODUCTS ||--o{ IMAGE_EXPERIMENT_STATS : "A/B results"
    USERS ||--o{ IDEMPOTENCY_KEYS : "checkout retries"

    DARK_STORES {
        bigint id PK
        string store_code
        string name
        string city
        double latitude
        double longitude
    }
    PRODUCTS {
        bigint id PK
        string title
        string brand
        decimal base_price
        string image_url
        string image_url_b
        string image_alt
    }
    STORE_INVENTORIES {
        bigint id PK
        bigint dark_store_id FK
        bigint product_id FK
        int stock_quantity
        int sold_count
        decimal sale_price
        bigint version
    }
    ORDERS {
        bigint id PK
        string order_number
        string status
        string payment_method
        decimal total_amount
        double rider_latitude
        double rider_longitude
        timestamp reservation_expires_at
        string refund_status
    }
    PAYMENT_TRANSACTIONS {
        bigint id PK
        bigint order_id FK
        string gateway
        string gateway_order_id
        string gateway_payment_id
        string status
        decimal amount
    }
    WEBHOOK_EVENTS {
        bigint id PK
        string gateway
        string event_id
        string status
        int attempts
        timestamp next_attempt_at
    }
```

Migrations live in [`backend/src/main/resources/db/migration`](../backend/src/main/resources/db/migration):

| Version | Contents |
|---|---|
| V1 | Core schema: stores, users, categories, products, per-store inventory, coupons, orders, items, status history |
| V2 | Catalogue seed: 7 dark stores, 26 categories, 192 products, 1,344 inventory rows |
| V3 | Login stats, sold counts, image fields |
| V4 | Three Andhra Pradesh dark stores (Vijayawada ×2, Guntur) |
| V5 | Payments, webhook inbox, idempotency keys, structured addresses, image A/B stats, rider freshness |
| V6 | Real product photography for fresh produce + 24 more fruits & vegetables |

---

## 7. Product images pipeline

```mermaid
flowchart LR
    A["Admin uploads JPG / PNG / WebP / AVIF<br/>(≤ 5 MB)"] --> B["ImageProcessor<br/>resize ≤ 1600 px · strip EXIF<br/>content-hash file name"]
    B --> C{"STORAGE_PROVIDER"}
    C -->|supabase| D[("Supabase Storage")]
    C -->|s3| E[("S3 / R2 / MinIO")]
    C -->|local| F[("uploads volume")]
    D --> G["CDN (optional)"]
    E --> G
    F --> H["/media proxy"]
    G --> I["next/image<br/>AVIF / WebP · srcset · lazy load"]
    H --> I
    I --> J["Product card<br/>alt text · A/B variant · emoji fallback"]
```

Content-hashed names make every URL immutable, so browsers and CDNs can cache for a year and a new photo is picked up instantly. Each product can carry a **B photo**; the storefront splits traffic 50/50, records impressions and add-to-carts, and the admin can promote the winner.

---

## 8. Reliability patterns

| Concern | Pattern |
|---|---|
| Double-clicks / retries on checkout | `Idempotency-Key` header → same order returned for the same key |
| Overselling | Per-store stock reserved at checkout under row locks (all-or-nothing); released on failure/expiry/cancel |
| Duplicate or out-of-order webhooks | Inbox table, unique `(gateway, event_id)`, processed once in its own transaction |
| Failed webhook processing | Exponential back-off retry (1 → 60 min), `DEAD` after max attempts with a Slack alert |
| Lost webhooks | Gateway status reconciliation before a reservation expires |
| Flaky third-party APIs | Shared HTTP client: timeouts, 3 attempts with back-off for idempotent calls, per-call metrics |
| WebSocket outages | Polling fallback every 10 s, stale-location warning, socket never torn down by a denied subscription |

---

## 9. Observability

- Every response carries an `X-Request-Id`, and every log line includes it.
- `/actuator/prometheus` exposes HTTP latency histograms, `quickcart.external.calls` timers and business counters.
- `docker compose --profile monitoring up` starts Prometheus (:9090) and Grafana (:3001) with a provisioned **QuickCart Ops** dashboard.
- Slack alerts for new orders, low stock, payment failures and dead webhooks (when `SLACK_WEBHOOK_URL` is set).
