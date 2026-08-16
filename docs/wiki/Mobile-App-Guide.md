# 📱 Mobile Application Guide (Citizen & Responder)

The SERS Mobile App (`apps/mobile`) is built with React Native and Expo, providing dual interfaces tailored for **Citizens/Victims** and **Ambulance Drivers/Paramedics**.

---

## 🚨 Citizen Interface

```
┌──────────────────────────────────────────────────────────┐
│                   SERS EMERGENCY CITIZEN                 │
│                                                          │
│     [  🚨 HOLD 3s FOR PANIC SOS  ]                       │
│                                                          │
│  🎙️ Voice SOS: "Help SERS Emergency"                     │
│  🚗 Auto-Crash Detection: ACTIVE (Sensors Armed)         │
│  🩸 Blood Group: O+ | ABHA ID: 91-4829-1092-4912        │
│                                                          │
│  [ Nearest Hospitals ]    [ Family Contacts Broadcast ]  │
└──────────────────────────────────────────────────────────┘
```

### Key Citizen Features:
1. **1-Tap Panic SOS**:
   - 3-second haptic-buffered hold button to trigger instant dispatch with exact GPS coordinates.
2. **AI Voice SOS**:
   - Hands-free voice trigger ("Help SERS Emergency") when victim is trapped or immobilized.
3. **Background Crash Sentry**:
   - Continuous background accelerometer and gyroscope sampling to auto-detect vehicle collisions.
4. **Emergency Health Card**:
   - Instant lock-screen summary showing victim blood group, chronic conditions, and emergency contact numbers.

---

## 🚑 Ambulance Responder Interface

```
┌──────────────────────────────────────────────────────────┐
│                 SERS FIRST RESPONDER DESK                │
│                                                          │
│  🔴 ACTIVE DISPATCH: Trauma Level 1 | Score: 0.94        │
│  📍 Victim Location: NH-44, Km 182 (2.4 km away)         │
│  🩸 Victim: Arjun Kumar (A+) | Allergies: Penicillin     │
│                                                          │
│  [ 🗺️ Start Golden Hour Navigation (Green Wave) ]        │
│  [ 🏥 Target Hospital: City Trauma Center (5 ICU Beds) ]  │
│  [ 📡 Stream Live Patient Vitals (SpO2 / HR / BP) ]      │
└──────────────────────────────────────────────────────────┘
```

### Key Responder Features:
1. **Dynamic Golden-Hour Navigation**:
   - Real-time turn-by-turn routing with traffic avoidance and emergency corridor coordination.
2. **Pre-Arrival Hospital Handshake**:
   - One-tap status update to notify the incoming hospital ER team of estimated arrival time (ETA) and patient vitals.
3. **Paramedic Vitals Streaming**:
   - Direct Bluetooth/manual telemetry input for Heart Rate, SpO2, and Blood Pressure, streamed live to the doctor's command screen.

---

## 🔐 Authentication & Roles

- **Password Login**: Phone/Email + Password with show/hide eye toggle (`👁️` / `🙈`).
- **Secure OTP Verification**: 6-digit SMS/Email verification with on-screen preview toggle for testing.
- **Strict Role-Based Registration**:
  - **Citizen**: Name, Phone, Email, Blood Group, Govt ID (Aadhaar/PAN/DL/Voter ID), ABHA ID, and Vehicle Number.
  - **Responder**: Legal Name, Phone, Email, Responder Badge ID, Ambulance Vehicle Reg Number, and Emergency Driving License.
