# SERS — Production Deployment Guide

> **Production Deployment Guide for SERS (Smart Emergency Response System)**  
> Supports Docker Compose, Kubernetes (K8s), AWS EC2/ECS, GCP Compute/GKE, and DigitalOcean.

---

## 1. Production Prerequisites

- **Docker** 24.0+ & **Docker Compose** v2.20+
- **Node.js** 20+ (LTS) & **npm** 10+
- **Python** 3.11+ (for local ML dev)
- **Domain & SSL**: Valid Domain Name (e.g. `sers.india.gov.in` or `sers-app.com`) + Let's Encrypt / Certbot SSL

---

## 2. Environment Variables Configuration

Copy `.env.example` to `.env` and populate production secrets:

```bash
# Server & Security
NODE_ENV=production
PORT=3000
JWT_SECRET=your_production_secure_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_production_refresh_token_secret
ENCRYPTION_KEY=your_32_byte_aes_encryption_key_here

# PostgreSQL + PostGIS
DB_HOST=postgres
DB_PORT=5432
DB_NAME=sers_db
DB_USER=sers_user
DB_PASSWORD=your_secure_db_password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_redis_password

# External Integrations
GEMINI_API_KEY=your_google_gemini_api_key
ABDM_CLIENT_ID=your_abdm_sandbox_or_prod_client_id
ABDM_CLIENT_SECRET=your_abdm_client_secret
MSG91_AUTH_KEY=your_msg91_sms_gateway_key
FCM_SERVER_KEY=your_firebase_push_notification_key
```

---

## 3. Production Deployment via Docker Compose

Run the entire microservice stack in production detached mode:

```bash
# 1. Build and launch containers
docker-compose -f docker-compose.yml up -d --build

# 2. Run Idempotent Migrations & Seeding
docker exec -it sers_api npm run db:migrate
docker exec -it sers_api npm run db:seed

# 3. Verify Health Endpoints
curl http://localhost:3000/api/health
curl http://localhost:8001/health
```

---

## 4. Production Service Matrix & Reverse Proxy Routing

| Service | Port | Production Nginx Route | Healthcheck Endpoint |
| :--- | :--- | :--- | :--- |
| **API Gateway** | `3000` | `https://sers-app.com/api` | `/api/health` |
| **ML Microservice** | `8001` | `https://sers-app.com/ml` | `/health` |
| **Public Web Portal** | `3001` | `https://sers-app.com` | `/` |
| **Admin Command Center** | `3002` | `https://admin.sers-app.com` | `/` |
| **Mobile App (Expo)** | `8081` | Expo EAS / APK Release Build | N/A |
