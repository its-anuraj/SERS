# 🚨 SERS — Smart Emergency Response System

> **AI-Powered, Multimodal Hardware-Integrated Emergency Dispatch & Hospital Trauma Coordination Platform**  
> *Transforming India's Golden Hour emergency healthcare using 6-Layer Anti-Fake Verification, Smartwatch Vitals, Barometric Airbag Shockwave Detection, and Real-Time Hospital Telemetry.*

---

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20Hospital%20Portal-black?style=for-the-badge&logo=vercel)](https://sers-web-admin.vercel.app)
[![Render Backend](https://img.shields.io/badge/Render-Backend%20API%20Live-46e3b7?style=for-the-badge&logo=render)](https://sers-backend-api.onrender.com)
[![Render ML](https://img.shields.io/badge/Render-Python%20ML%20Live-46e3b7?style=for-the-badge&logo=render)](https://sers-09fb.onrender.com)
[![PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL%20%2B%20PostGIS-336791?style=for-the-badge&logo=postgresql)](https://neon.tech)
[![Redis](https://img.shields.io/badge/Upstash-Redis%20Cache-FF4438?style=for-the-badge&logo=redis)](https://upstash.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](#-license)

---

## 🌐 Live Production Deployments

Experience the live system running on production cloud infrastructure:

| Component | Platform | Live URL | Description |
| :--- | :--- | :--- | :--- |
| **🏥 Hospital Command Portal** | **Vercel** | [**sers-web-admin.vercel.app**](https://sers-web-admin.vercel.app) | Live Hospital Emergency Desk, Bed Tracker, Doctor Attendance & Radar |
| **⚡ REST & WebSocket API** | **Render** | [**sers-backend-api.onrender.com**](https://sers-backend-api.onrender.com) | Node.js/Express Real-time API Gateway & Socket.io Server |
| **🧠 AI/ML Microservice** | **Render** | [**sers-09fb.onrender.com**](https://sers-09fb.onrender.com) | FastAPI Microservice for Crash Scoring, Severity & Route Optimization |
| **🗄️ PostgreSQL + PostGIS** | **Neon Cloud** | `sers-database (ap-southeast-1)` | Spatial Geolocation Queries, 20+ Normalized Schemas |
| **⚡ Telemetry Cache** | **Upstash Cloud** | `sers-redis (ap-south-1 Mumbai)` | Sub-millisecond Live GPS Telemetry, Rate Limiting & Pub/Sub |
| **📱 Mobile Application** | **Expo EAS Cloud** | `in.sers.emergency` | React Native Android APK for Citizens and First Responders |

### 🔑 Demo Login Credentials

You can test the live portal using the following pre-configured credentials:

| Role | Email / ID | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **🏥 Hospital Command Desk** | `drmeera@demo.sers.in` | `Test@1234` | Live Trauma Triage, ICU/ER Bed Management, Patient Influx |
| **⚡ Dispatch Lead / Admin** | `admin@sers.in` | `Test@1234` | City-wide Emergency Dispatch, Ambulance Fleet, Hotspots |
| **👨‍⚕️ Emergency Doctor** | `drrajesh@demo.sers.in` | `Test@1234` | 1-Tap On-Duty / OT / On-Call Attendance & Specialty Status |

## 📖 What is SERS & How It Works in Simple Words?

> **Imagine a highway collision or sudden cardiac arrest at 2:00 AM where the victim falls unconscious and cannot reach their phone.** Here is the step-by-step life-saving journey SERS executes in seconds:

```
🚗 ACCIDENT OCCURS 
       │
       ▼ (Sensors detect shock & airbag)
📱 AUTO SOS TRIGGERED 
       │
       ▼ (AI eliminates fake alerts in 0.5s)
⚡ CLOUD AI VERIFICATION 
       │
       ▼ (Sends live GPS & severity)
🏥 HOSPITAL DASHBOARD & 🚑 AMBULANCE DISPATCHED 
       │
       ▼ (Turn-by-turn traffic-free GPS)
📍 RESCUE AT SCENE & LIVE VITALS STREAMING 
       │
       ▼ (Hospital ICU & Doctors ready before arrival)
❤️ ZERO-DELAY EMERGENCY TREATMENT (LIFE SAVED!)
```

### ⏱️ Step-by-Step Life-Saving Walkthrough:

1. **Step 1: Automatic Sensor Trigger (No Human Action Needed)**
   - The moment a crash occurs, the smartphone's **Accelerometer (G-force deceleration)**, **Barometer (Airbag deployment pressure shockwave)**, and **Smartwatch (Trauma heart rate spike)** automatically detect the event. The victim does NOT need to unlock or touch their phone.

2. **Step 2: 0.5-Second Cloud AI Anti-Fake Filter**
   - The cloud engine instantly cross-validates: *"Did the phone just drop on the car floor, or was it a real collision?"*
   - If the vehicle continues cruising at 60 km/h after a drop, the alert is **auto-cancelled**. If the vehicle stalls and heart rate spikes, it is confirmed as a **100% verified real emergency**.

3. **Step 3: Instant Red Alert on Hospital Emergency Desks 🚨**
   - With an audible alarm and visual red radar blink, the incident pops up live on connected hospital command portals ([`sers-web-admin.vercel.app`](https://sers-web-admin.vercel.app)).
   - Doctors instantly see the GPS location, crash severity rating (Minor, Moderate, Critical), and expected trauma requirements.

4. **Step 4: Nearest Ambulance Auto-Dispatched with Turn-by-Turn GPS 🚑**
   - SERS geospatial algorithms automatically assign the **closest available Advanced Life Support (ALS) ambulance**.
   - The driver gets a 1-tap accept notification and live traffic-optimized turn-by-turn GPS navigation straight to the victim.

5. **Step 5: Scene Rescue & On-Route Vitals Streaming**
   - Paramedics stabilize the victim and load them into the ambulance.
   - Throughout transit, live biometric vitals (pulse, ECG, oxygen levels) stream directly to the receiving hospital's triage team.

6. **Step 6: Zero-Delay Hospital Admission (Golden Hour Saved) 🏥**
   - 10 minutes before the ambulance arrives at the hospital gates, the ER has already **reserved the ICU bed, pre-notified on-duty trauma surgeons, and prepared matching blood units**.
   - The patient is wheeled directly into surgery with zero registration delays.

---

## ⚡ The SERS System Workflow

```
[ 1. MULTIMODAL SENSOR EVENT ]
   ├── Smartphone G-Force Accelerometer (>24.5 m/s²)
   ├── Smartphone Barometer (Airbag Cabin Pressure Shockwave: +10 to +35 hPa within 50ms)
   ├── Vehicle OBD-II CAN-Bus (Airbag PID Trigger `01 02` & Engine Stall 0 RPM)
   └── Smartwatch BLE GATT Vitals (Heart Rate Trauma Spike >140 BPM or Cardiac Arrest)
                                       │
                                       ▼
[ 2. AFDP v2 ANTI-FAKE VERIFICATION GATEWAY ]
   ├── Cross-validates Physical Impact + Biometric Trauma
   ├── Evaluates Car-Floor Phone Drop Filter (Post-impact speed > 20 km/h -> AUTO-CANCEL)
   └── Generates Incident Confidence Score (0% to 100%)
                                       │
                                       ▼
[ 3. FASTAPI AI/ML MICROSERVICE ]
   ├── Scikit-Learn Random Forest & Gradient Boosting Severity Scoring
   ├── Geospatial Nearest-Hospital-With-Matching-Capacity Algorithm
   └── Dynamic Dijkstra Route Optimization avoiding real-time congestion
                                       │
                                       ▼
[ 4. REAL-TIME DISPATCH & WEBSOCKET STREAM ]
   ├── Socket.io pushes live incident alert with ❤️ BPM badge & 💥 AIRBAG marker
   ├── Auto-allocates nearest available ALS/BLS Ambulance with turn-by-turn navigation
   └── Live WebSocket stream synchronizes with Hospital Command Desks
                                       │
                                       ▼
[ 5. HOSPITAL ER & TRAUMA TEAM HANDOFF ]
   ├── Hospital receives victim vitals stream & trauma severity 10 minutes BEFORE arrival
   ├── Emergency Room reserves ICU/ER bed and alerts on-duty trauma surgeons
   └── Seamless stabilization within the Golden Hour window!
```

---

## 🛡️ The 6-Layer Anti-Fake Verification Matrix (AFDP v2)

To eliminate false dispatches, SERS enforces the **Anti-False-Dispatch Protocol (AFDP v2)**:

| Layer | Physical / Sensor Data Source | Verification Signal / Threshold | Anti-Fake Purpose |
| :--- | :--- | :--- | :--- |
| **Layer 1** | **Smartphone Accelerometer + Gyro** | Deceleration > 24.5 m/s² & Rollover Angle | Detects physical impact and vehicle rollover. |
| **Layer 2** | **Smartphone Barometer (Zero Cost)** | Cabin Pressure Spike (+10 to +35 hPa within 50ms) | **Airbag Deployment Shockwave**: Airbag explosion creates an instant sealed cabin pressure pulse. |
| **Layer 3** | **Vehicle OBD-II / CAN-Bus** | Airbag Deployment PID `01 02` & Engine Stall (0 RPM) | Direct diagnostic confirmation from the vehicle ECU. |
| **Layer 4** | **Audio Acoustic ML Model** | Metal crunch / glass shatter frequency score (>0.80) | Distinguishes severe metal crash sounds from a phone dropping on carpet. |
| **Layer 5** | **Smartwatch Vitals (BLE GATT `0x180D`)**| Heart Rate spike (>140 BPM) + Victim Immobility | Confirms physiological human trauma and incapacitation. |
| **Layer 6** | **Post-Impact GPS Motion Filter** | Device speed post-impact > 20 km/h | **Phone Drop Filter**: If phone fell off dashboard while car keeps driving, **AUTO-CANCEL FAKE ALERT!** |

---

## 🏗️ System Architecture & Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT APPLICATIONS                              │
│   📱 Mobile App (React Native Expo)         💻 Hospital Command Center (Next.js)│
│   - Citizen SOS & Crash Telemetry            - Live Triage & Regional Radar Map │
│   - Responder Turn-by-Turn GPS Nav           - Bed Capacity & Doctor Attendance │
└───────────────────────┬─────────────────────────────────┬───────────────────────┘
                        │                                 │
                        └────────────────┬────────────────┘
                                         │ (HTTPS / Secure WebSockets)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ⚡ NODE.JS 20 + EXPRESS API GATEWAY                     │
│   - JWT Role-Based Auth (Citizen, Responder, Hospital Staff, Admin, Doctor)     │
│   - AFDP v2 Anti-Fake Verification Engine                                       │
│   - Real-Time Bidirectional WebSockets (Socket.io)                              │
└───────────────────────┬─────────────────────────────────┬───────────────────────┘
                        │                                 │
         ┌──────────────┴──────────────┐   ┌──────────────┴──────────────┐
         ▼                             ▼   ▼                             ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│  🗄️ PostgreSQL + PostGIS │ │    ⚡ Upstash Redis 7    │ │  🧠 Python FastAPI ML   │
│  - Spatial Geocoding    │ │  - Telemetry Cache (30s)│ │  - AI Crash Detection   │
│  - 20 Normalized Tables │ │  - Live Dispatch Pub/Sub│ │  - Severity Classifier  │
│  - Audit Logs & History │ │  - API Rate Limiting    │ │  - Hotspot Prediction   │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
```

---

## 📊 Current Progress & Implemented Features

- [x] **PostgreSQL & PostGIS Database Engine:** 20 relational tables with spatial geometry indexing deployed on Neon Cloud.
- [x] **Upstash Redis Real-Time Caching:** Ultra-fast telemetry storage for live ambulance GPS tracking and hospital capacity sync.
- [x] **FastAPI AI/ML Microservice:** Random Forest and Gradient Boosting inference for crash severity scoring and hospital matching deployed on Render.
- [x] **Node.js Express Backend API:** 35+ REST endpoints, JWT authentication, and Socket.io WebSocket rooms deployed on Render.
- [x] **Next.js 14 Hospital Portal:** Multi-tenant web dashboard with Leaflet regional maps, ICU/ER bed capacity toggles, and Doctor On-Duty attendance deployed on Vercel.
- [x] **Enforced Authentication Guard:** Unauthenticated sessions are automatically routed to the Login portal.
- [x] **React Native Mobile App:** Citizen SOS, Bluetooth OBD-II/smartwatch telemetry simulator, and EAS APK configuration.

---

## 🔮 Future Roadmap

- [ ] **🚁 Drone Defibrillator (AED) Dispatch:** Autonomous dispatch of automated external defibrillator (AED) drones to cardiac arrest coordinates before ambulance arrival.
- [ ] **🔌 Low-Cost OBD-II BLE Dongle:** Plug-and-play vehicle hardware module for older and non-connected cars.
- [ ] **🇮🇳 National ABDM / ABHA Integration:** Direct synchronization with Ayushman Bharat Digital Mission (ABDM) for FHIR medical records and cashless emergency insurance pre-authorization.
- [ ] **🗣️ Multi-Lingual AI Voice Triage Agent:** Voice assistant supporting 12+ Indian regional languages (Hindi, Tamil, Telugu, Bengali, Kannada, Marathi, etc.) with real-time speech-to-text.
- [ ] **🚥 Dynamic Green Corridor Traffic Light Preemption:** Automated integration with city traffic management systems to turn signals green for approaching ambulances.

---

## 🤝 Contributing & Pull Requests (PRs)

We welcome contributions from developers, healthcare technologists, and researchers! If you'd like to help build the future of emergency healthcare, feel free to open a **Pull Request (PR)**.

### How to Contribute:

1. **Fork the Repository:** Click the **Fork** button at the top-right of this repository.
2. **Clone your Fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/SERS.git
   cd SERS
   ```
3. **Create a Feature Branch:**
   ```bash
   git checkout -b feature/amazing-emergency-feature
   ```
4. **Make Your Changes & Test Locally:**
   - Test Backend: `npm --prefix services/api test`
   - Test ML Microservice: `pytest services/ml`
   - Test Web Portal: `npm --prefix apps/web-admin run build`
5. **Commit Your Changes:**
   ```bash
   git commit -m "feat: Add dynamic green corridor traffic signal preemptor"
   ```
6. **Push to Your Fork:**
   ```bash
   git push origin feature/amazing-emergency-feature
   ```
7. **Open a Pull Request:**
   - Go to the original [**its-anuraj/SERS**](https://github.com/its-anuraj/SERS) repository on GitHub.
   - Click **"Compare & pull request"**.
   - Describe your changes, screenshots (if UI related), and why it benefits the emergency response system.
   - We will review your PR, suggest any improvements if needed, and merge it into `main`! 🎉

---

## 🛠️ Local Development Setup

### Prerequisites
- **Node.js** v20+ & **npm** v10+
- **Python** 3.11+
- **Docker & Docker Compose** (Optional for containerized run)

### 1. Clone the Project
```bash
git clone https://github.com/its-anuraj/SERS.git
cd SERS
```

### 2. Environment Configuration
Copy the sample environment variables:
```bash
cp .env.example .env
```

### 3. Run Locally (Fast Setup)

#### Terminal 1 — Backend API:
```bash
cd services/api
npm install
npm run dev
```

#### Terminal 2 — Python ML Microservice:
```bash
cd services/ml
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

#### Terminal 3 — Web Hospital Portal:
```bash
cd apps/web-admin
npm install
npm run dev
```
Open [http://localhost:3002](http://localhost:3002) in your browser!

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

Developed with ❤️ for India's Healthcare & Emergency Response Infrastructure.
