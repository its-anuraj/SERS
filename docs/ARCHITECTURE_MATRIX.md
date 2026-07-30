# SERS — Requirements & Architecture Traceability Matrix (Waterfall SDLC)

> **Document Version**: 2.0.0  
> **System Scope**: Smart Emergency Response System (AI-Powered, ABDM-Compliant, Multi-Sensor Telemetry)

---

## 1. Requirements Traceability Matrix (RTM)

| Requirement ID | Module / Subsystem | Functional Requirement | Technical Implementation | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | Mobile & Web SOS | One-Tap SOS Dispatch & Geolocation Ingestion | `apps/web-public/app/sos/page.tsx`, `apps/mobile/app/sos-active.tsx` | End-to-End HTTP / Socket Test | ✅ Complete |
| **REQ-02** | AFDP v2 Engine | 6-Layer Multi-Sensor Crash & False-Alarm Verification | `services/api/src/services/afdp.service.js` | Unit Tests & Telemetry Matrix | ✅ Complete |
| **REQ-03** | Smartwatch Sync | Real-time Heart Rate & Pulse Monitoring | `apps/web-public/components/SmartwatchWidget.tsx`, `smartwatchService.ts` | Web Bluetooth GATT (0x180D) | ✅ Complete |
| **REQ-04** | OBD-II Telemetry | Airbag Deployment & CAN-bus Telemetry Ingestion | `apps/web-public/components/VehicleTelemetryWidget.tsx`, `obdVehicleService.ts` | Barometer Spike + ECU PID Test | ✅ Complete |
| **REQ-05** | ML Microservice | AI Crash Detection & Hospital Route Optimization | `services/ml/main.py`, `routers/crash_detection.py` | FastAPI Endpoint Benchmark | ✅ Complete |
| **REQ-06** | Command Center | Admin Real-time Live Fleet & Incident Tracking | `apps/web-admin/app/page.tsx` | WebSocket Broadcast Verification | ✅ Complete |
| **REQ-07** | ABDM Integration | ABHA Health ID Pre-Auth & Emergency Access | `services/api/src/abdm/` | ABDM Sandbox Mock Verification | ✅ Complete |

---

## 2. System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|  +-------------------------+  +-------------------------+  +-------------------+  |
|  | Web Public Portal (3001)|  | Admin Dashboard (3002)  |  | Mobile App (8081) |  |
|  | Next.js 14 / Tailwind   |  | Command Center / React  |  | React Native Expo |  |
|  +------------+------------+  +------------+------------+  +---------+---------+  |
+---------------|----------------------------|-------------------------|------------+
                |                            |                         |
                +--------------------+-------+-------------------------+
                                     | (REST API / WebSockets)
                                     v
+-----------------------------------------------------------------------------------+
|                                API GATEWAY LAYER                                  |
|  Node.js 20 + Express + Socket.io Server (Port 3000)                               |
|  - Rate Limiting & Helmet Security                                                |
|  - AFDP v2 Anti-Fake Verification Engine                                           |
|  - Realtime Telemetry Broadcast                                                   |
+---------------------+-------------------------------+-----------------------------+
                      |                               |
        +-------------+-------------+   +-------------+-------------+
        |                           |   |                           |
        v                           v   v                           v
+---------------+           +---------------+           +-----------------------+
| PostgreSQL 16 |           |    Redis 7    |           | Python FastAPI ML (8001)|
| PostGIS Spatia|           | Pub/Sub Cache |           | AI Crash & Severity   |
+---------------+           +---------------+           +-----------------------+
```
