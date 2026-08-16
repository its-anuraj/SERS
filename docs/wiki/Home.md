# 🚨 SERS — Smart Emergency Response System Wiki

Welcome to the official **SERS (Smart Emergency Response System)** Knowledge Base and Technical Wiki.

> **SERS** is an enterprise-grade, multimodal hardware-integrated emergency response and hospital trauma coordination platform engineered to eliminate Golden Hour mortality in India and global smart cities.

---

## 🌟 Core Pillars

```
                     ┌─────────────────────────────────────────┐
                     │   SERS Multimodal Emergency Platform    │
                     └────────────────────┬────────────────────┘
                                          │
       ┌──────────────────┬───────────────┴───────────────┬──────────────────┐
       ▼                  ▼                               ▼                  ▼
 📱 Citizen App    🚑 Responder App               🏥 Hospital Portal   🧠 AI Verification
- 1-Tap SOS       - Turn-by-Turn GPS              - Bed Allocations   - 6-Layer Anti-Fake
- Voice Trigger   - Green Corridor Radar          - Trauma Triage     - Shockwave Airbag
- Crash Sensors   - Telemetry Stream              - Doctor Roster     - Severity Scoring
```

1. **AI-Powered 6-Layer Crash Verification**:
   - Differentiates severe vehicular impacts from dropped phones or potholes in **under 500ms** using 3-axis accelerometer, gyroscope, barometric airbag shockwave analysis, and smartwatch photoplethysmography (PPG) vitals correlation.

2. **Sub-Second Golden Hour Dispatch**:
   - Dispatches the geographically closest ALS/BLS ambulance and pre-notifies the nearest Level-1/2 trauma hospital with live GPS telemetry, victim blood group, and incoming vitals.

3. **Dynamic Hospital Bed & Trauma Telemetry**:
   - Real-time live ICU, Ventilator, and ER bed availability across city hospitals, preventing patient refusal and critical transit delays.

4. **Biometric & Identity Integration**:
   - Seamless ABDM (Ayushman Bharat Digital Mission) ABHA health ID support, emergency contact instant broadcasting, and role-restricted security.

---

## 📚 Wiki Navigation

| Section | Description |
| :--- | :--- |
| [**System Architecture**](System-Architecture) | Monorepo breakdown, database schemas, Redis cache, and microservices |
| [**Mobile App Guide**](Mobile-App-Guide) | Citizen SOS, Responder golden-hour routing, and biometric telemetry |
| [**Hospital Command Center**](Hospital-Command-Center) | ER bed manager, trauma triage dashboard, and doctor attendance radar |
| [**AI Crash Detection & Verification**](AI-Crash-Detection-and-Verification) | 6-Layer anti-fake pipeline, barometric shockwaves, and ML scoring |
| [**API Reference & WebSockets**](API-Reference-and-WebSockets) | Complete RESTful endpoints, WebSocket events, and JWT authentication |
| [**Deployment & Operations**](Deployment-and-Operations) | Local setup, Docker, Neon Postgres, Render, Vercel, and Expo EAS APK builds |

---

## 🔗 Live Production Links

- **🏥 Hospital Command Portal**: [sers-web-admin.vercel.app](https://sers-web-admin.vercel.app)
- **⚡ Backend API Gateway**: [sers-backend-api.onrender.com](https://sers-backend-api.onrender.com)
- **🧠 Python AI/ML Microservice**: [sers-09fb.onrender.com](https://sers-09fb.onrender.com)
- **📱 Standalone Android APK**: [Download Latest SERS_App.apk](https://github.com/its-anuraj/SERS/releases/latest)
- **💻 GitHub Repository**: [github.com/its-anuraj/SERS](https://github.com/its-anuraj/SERS)
