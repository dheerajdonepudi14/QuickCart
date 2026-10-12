<div align="center">

# 🛒 QuickCart

### A full-stack hyperlocal grocery shopping and quick-commerce platform

Browse groceries, manage a cart, check out with configurable payment options, choose delivery addresses on a map, and track orders. QuickCart also includes rider workflows, store administration, and operational monitoring.

![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3-6DB33F?logo=springboot&logoColor=white)
![Java](https://img.shields.io/badge/Java-17-ED8B00?logo=openjdk&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

</div>

---

## Overview

QuickCart is designed as a quick-commerce application for shoppers, delivery partners, and store teams. The codebase includes a Next.js storefront, a Spring Boot API, database migrations, Docker Compose configuration, CI workflow, and monitoring configuration.

## Features

- **Shopping experience:** product browsing, categories, search, product details, cart, wishlist, coupons, and order history.
- **Checkout:** delivery address entry, map-based location selection, configurable payment integrations, and stock reservation flow.
- **Order tracking:** order status updates and map-oriented tracking components.
- **Rider experience:** assigned deliveries, location sharing, and delivery status updates.
- **Store administration:** inventory, user management, analytics, order operations, and product-image management.
- **Operations:** Docker Compose, GitHub Actions CI, Prometheus metrics, and Grafana dashboards.

> Payment gateways, OAuth providers, maps, storage, and notification integrations may require valid credentials and environment configuration. Verify each integration in a test environment before production use.

## Technology stack

| Area | Technologies |
|---|---|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| State and data | Zustand, TanStack Query |
| Backend | Java 17, Spring Boot 3.3 |
| Database | PostgreSQL, Flyway migrations |
| Payments | Configurable UPI, Razorpay, PhonePe, Stripe and cash-on-delivery flows |
| Maps | Leaflet and configurable OpenStreetMap / geocoding services |
| Storage | Local or configurable S3-compatible storage |
| DevOps and monitoring | Docker Compose, GitHub Actions, Prometheus, Grafana |

## Repository structure

```text
QuickCart/
├── backend/        Spring Boot API and database migrations
├── frontend/       Next.js storefront, checkout, rider and admin experiences
├── monitoring/     Prometheus and Grafana configuration
├── postman/        API testing assets
├── docs/           Architecture notes and screenshots
├── tools/          Development utilities
├── .github/        CI workflow
├── docker-compose.yml
└── .env.example    Environment-variable template
```

## Getting started

### Prerequisites

- Docker Desktop or Docker Engine with Docker Compose v2
- For local development: Java 17, Maven, Node.js 20+, and PostgreSQL

### Run with Docker

```bash
git clone https://github.com/dheerajdonepudi14/QuickCart.git
cd QuickCart
cp .env.example .env
docker compose up --build
```

Review `.env.example` and the Compose configuration before starting services. Configure any integrations you want to test, and never commit real credentials to Git.

Common local endpoints (when the corresponding services are running):

| Service | URL |
|---|---|
| Storefront | http://localhost:3000 |
| Rider app | http://localhost:3000/rider |
| Admin dashboard | http://localhost:3000/admin/dashboard |
| Backend API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |

Monitoring services may be available when the relevant Compose profile is enabled; check `docker-compose.yml` for the configured ports and credentials.

## Configuration and security

1. Start from `.env.example`; set only the variables needed for your local environment.
2. Use sandbox/test credentials for payment providers during development.
3. Keep JWT secrets, database passwords, OAuth secrets, API keys, and webhook secrets out of source control.
4. Change demo credentials and default passwords before any shared or production deployment.
5. Validate authentication, authorization, payment-webhook signatures, upload restrictions, and location-data handling before production use.

## Development checks

The repository includes a GitHub Actions workflow under `.github/workflows/`. Review that workflow for the exact checks currently configured. Run the relevant frontend and backend tests before submitting changes.

## Documentation

- [Architecture and design notes](docs/ARCHITECTURE.md)
- [CI workflow](.github/workflows/ci.yml)
- [Environment template](.env.example)

## License

Distributed under the MIT License. See [LICENSE](LICENSE).

---

<div align="center">

Built as a full-stack quick-commerce project.

</div>
