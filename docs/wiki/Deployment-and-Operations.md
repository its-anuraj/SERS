# 🚀 Deployment & Operations Guide

This guide covers running SERS locally and deploying to production cloud infrastructure (Vercel, Render, Neon, Upstash, and Expo EAS).

---

## 💻 Local Development Setup

### Prerequisites:
- Node.js 18+ (LTS)
- Python 3.10+
- PostgreSQL 15+ (with PostGIS extension) or Neon Cloud connection
- Redis (Local or Upstash Cloud)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/its-anuraj/SERS.git
cd SERS

# Install root & workspace packages
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate database URL, Redis credentials, and JWT secret keys.

### 3. Start Backend Services
```bash
# Start API Gateway (Port 3000)
cd services/api
npm run dev

# Start ML Microservice (Port 8000)
cd ../ml-service
uvicorn main:app --reload --port 8000
```

### 4. Start Frontend & Mobile Apps
```bash
# Hospital Command Portal (Port 3002)
cd apps/web-admin
npm run dev

# Mobile App (Expo Metro Bundler)
cd apps/mobile
npm run start
```

---

## ☁️ Production Cloud Deployments

```
┌──────────────────────────────────────────────────────────┐
│              SERS PRODUCTION CLOUD TOPOLOGY              │
├──────────────────────────┬───────────────────────────────┤
│ Frontend (Next.js 14)    │ Vercel Edge Network           │
│ Backend API Gateway      │ Render Web Service (Node.js)  │
│ AI/ML Microservice       │ Render Web Service (FastAPI)  │
│ Database (PostGIS)       │ Neon Serverless PostgreSQL    │
│ Telemetry Cache          │ Upstash Managed Redis         │
│ Mobile Android APK       │ Expo EAS Cloud Build          │
└──────────────────────────┴───────────────────────────────┘
```

---

## 📱 Building Android APK with EAS

To compile the standalone `.apk` binary:

```bash
cd apps/mobile

# Build Android APK via Expo Cloud
npx eas-cli build -p android --profile preview
```

The APK binary will be compiled and ready to download or attach to GitHub Releases.
