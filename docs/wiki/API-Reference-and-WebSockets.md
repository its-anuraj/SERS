# 🔌 API Reference & WebSocket Gateway

The SERS backend exposes RESTful endpoints and real-time bidirectional WebSocket events for clients and hospital dashboards.

**Base URL**: `https://sers-backend-api.onrender.com/api`

---

## 🔐 Authentication Endpoints

### 1. Register User
- **`POST /auth/register`**
- Creates a new Citizen or Responder account.

#### Citizen Payload:
```json
{
  "name": "Arjun Kumar",
  "phone": "+919876500001",
  "email": "arjun@example.com",
  "password": "Test@1234",
  "role": "citizen",
  "bloodGroup": "O+",
  "govtIdType": "Aadhaar",
  "govtIdNumber": "XXXX-XXXX-1234",
  "abhaId": "91-4829-1092-4912",
  "vehicleNumber": "KA-05-MB-1024"
}
```

#### Responder Payload:
```json
{
  "name": "Ravi Paramedic",
  "phone": "+919876500003",
  "email": "ravi@example.com",
  "password": "Test@1234",
  "role": "responder",
  "badgeId": "AMB-BLR-104",
  "vehicleRegNumber": "KA-01-EA-1088",
  "drivingLicense": "DL-0420190012345"
}
```

---

### 2. Password Login
- **`POST /auth/login`**
```json
{
  "identifier": "+919876500001",
  "password": "Test@1234"
}
```

---

### 3. Send Verification Code (OTP)
- **`POST /auth/send-otp`**
```json
{
  "identifier": "+919876500001",
  "requireStaffRole": false
}
```

---

### 4. Verify OTP Code
- **`POST /auth/verify-otp`**
```json
{
  "identifier": "+919876500001",
  "otp": "123456"
}
```

---

## 🚨 Emergency Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/emergencies/trigger` | Trigger Panic SOS or sensor crash alert |
| `GET` | `/emergencies/active` | Retrieve active city incidents |
| `GET` | `/emergencies/:id` | Get incident details, victim health card, & assigned units |
| `PATCH` | `/emergencies/:id/status` | Update incident state (`dispatched`, `on_scene`, `transporting`, `resolved`) |

---

## 🏥 Hospital Resource Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/hospitals` | List all hospitals with live ICU, ER bed, & ventilator metrics |
| `PATCH` | `/hospitals/:id/capacity` | Update available bed counts & oxygen reserve status |
| `GET` | `/doctors/roster` | Fetch live doctor attendance & specialty availability |
| `POST` | `/doctors/attendance/toggle` | Toggle doctor duty status (`on_duty`, `in_ot`, `on_call`, `off_duty`) |

---

## ⚡ WebSocket Events (Socket.io)

Connect to: `https://sers-backend-api.onrender.com`

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `emergency:new` | Server $\to$ Client | `{ emergencyId, location, severity, victim }` | Broadcast new verified trauma incident |
| `ambulance:location` | Client $\to$ Server | `{ ambulanceId, latitude, longitude, speed }` | Paramedic telemetry stream |
| `hospital:capacity_update` | Server $\to$ Client | `{ hospitalId, icuBedsAvailable, erBedsAvailable }` | Live bed count update across command centers |
| `vitals:stream` | Client $\to$ Server | `{ emergencyId, heartRate, spO2, systolic, diastolic }` | Live patient vitals sent to hospital ER desk |
