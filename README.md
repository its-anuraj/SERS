# SERS — Smart Emergency Response System

> **AI-powered, proactive emergency response platform for India.**
> Detects crashes before you can call. Connects victims, responders, and hospitals in real-time. ABDM-compliant.

---

## 🏗️ Architecture

```
apps/
  mobile/         React Native (Expo) — Citizen + Responder apps
  web-public/     Next.js 14 — Public portal + Web SOS
  web-admin/      Next.js 14 — Admin Command Center + Hospital Dashboard

services/
  api/            Node.js + Express — Main REST API + Socket.io
  ml/             Python FastAPI — AI/ML microservice

infrastructure/
  docker-compose.yml
  nginx/
```

## 🚀 Quick Start

### Prerequisites
- Docker + Docker Compose
- Node.js 20+
- Python 3.11+

### 1. Clone & configure
```bash
git clone <repo>
cd sers
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Start infrastructure (DB + Redis)
```bash
docker-compose up -d postgres redis
```

### 3. Run database migrations
```bash
npm run db:migrate
npm run db:seed
```

### 4. Start all services
```bash
# Terminal 1 — API
npm run dev:api

# Terminal 2 — ML Service
npm run dev:ml

# Terminal 3 — Web Public
npm run dev:web-public

# Terminal 4 — Web Admin
npm run dev:web-admin
```

### 5. Mobile App
```bash
cd apps/mobile
npx expo start
```

## 🔑 Environment Variables
See [.env.example](.env.example) for all required variables.

## 📚 Docs
- [API Reference](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [ABDM Integration](docs/ABDM.md)
- [Deployment](docs/DEPLOYMENT.md)

## 📊 Tech Stack
| Layer | Technology |
|---|---|
| Mobile | React Native (Expo SDK 51) |
| Web | Next.js 14 (App Router) |
| API | Node.js 20 + Express 4 + Socket.io 4 |
| ML | Python 3.11 + FastAPI |
| DB | PostgreSQL 16 + PostGIS 3.4 |
| Cache | Redis 7 |
| Auth | JWT + OAuth2 |
| AI | TFLite (on-device), YOLOv8, Gemini API |

## 🏥 ABDM Integration
Full Ayushman Bharat Digital Mission integration:
- M1: ABHA ID linking via Aadhaar OTP
- M2: Health records discovery + emergency pre-authorization
- M3: Post-treatment record contribution

