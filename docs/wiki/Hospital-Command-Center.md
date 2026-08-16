# 🏥 Hospital Command Center & Web Portal

The SERS Hospital Command Center (`apps/web-admin`) is a Next.js 14 web application designed for emergency doctors, trauma directors, triage nurses, and city-wide dispatch coordinators.

---

## 🖥️ Portal Modules

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🏥 SERS HOSPITAL EMERGENCY COMMAND DESK               ● LIVE CONNECTED  │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ 🛏️ ICU BEDS: 12 │ 🚨 ER BEDS: 8    │ 🫁 VENTS: 6     │ 👨‍⚕️ ON DUTY: 14 │
├─────────────────┴──────────────────┴─────────────────┴─────────────────┤
│ 🚨 INCOMING TRAUMA INFLUX RADAR                                        │
│  [CRITICAL 0.94] ETA 4 min | Victim: Arjun Kumar (A+) | Bed #ICU-04     │
│  [SEVERE 0.81]   ETA 9 min | Victim: Priya Sharma (O-) | Bed #ER-02     │
├────────────────────────────────────────────────────────────────────────┤
│ 👨‍⚕️ DOCTOR DUTY ROSTER & SPECIALTY STATUS                               │
│  • Dr. Rajesh Kumar  | Neuro Trauma      | [🟢 ON DUTY] (OT Ready)      │
│  • Dr. Meera Nair    | Emergency Triage  | [🟢 ON DUTY] (Active Influx) │
│  • Dr. Amit Patel    | Orthopedic Trauma | [🟡 ON CALL] (Pager Sent)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛏️ Real-Time Bed & Resource Tracker

- **Live Bed Inventory**: Instant toggle to increment/decrement available ICU Beds, ER Trauma Bays, Ventilators, and Oxygen Cylinder stock.
- **Auto-Reservation**: When an incoming critical ambulance is assigned to the hospital, the system temporarily reserves an ICU bed, preventing overbooking.
- **Resource Shortage Alerts**: Visual warnings when ICU/Ventilator capacity drops below 15%.

---

## 👨‍⚕️ Doctor Attendance & Specialty Radar

- **1-Tap Duty Status Toggle**: Doctors can switch between `🟢 On Duty`, `🔵 In OT (Operation Theatre)`, `🟡 On Call`, and `⚪ Off Duty`.
- **Specialty Filter**: Instantly locate available Specialists (Neurosurgeons, Orthopedic Trauma, Anesthetists, Cardiologists).
- **Automated Trauma Callout**: High-severity incidents (>0.85) automatically notify on-duty specialists before the ambulance arrives.

---

## 🗺️ Live Emergency & Fleet Map

- Interactive Mapbox/Leaflet vector map displaying:
  - Active ALS/BLS Ambulances in transit with live speed and heading.
  - Incident locations with color-coded severity markers (Red = Critical, Amber = Moderate).
  - City hospital locations with real-time bed capacity pins.
