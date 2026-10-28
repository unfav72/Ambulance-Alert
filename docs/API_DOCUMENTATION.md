# REST API & Real-Time WebSocket Documentation

Base URL: `/api/v1`

All protected endpoints require an `Authorization: Bearer <jwt_token>` header.

---

## 1. Authentication Endpoints

### `POST /auth/register`
Registers a new patient / emergency requester account.
- **Access**: Public
- **Rate Limit**: 10 requests / 15 minutes
- **Request Body**:
  ```json
  {
    "email": "caller@example.com",
    "password": "SecurePassword!2026",
    "fullName": "Ananya Raman",
    "phone": "+919876543210"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "message": "Registration successful",
    "user": {
      "id": "uuid",
      "email": "caller@example.com",
      "fullName": "Ananya Raman",
      "role": "PATIENT_REQUESTER",
      "status": "ACTIVE"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### `POST /auth/login`
Authenticates a registered operator or patient.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "dispatcher@ems.gov",
    "password": "DispatcherPassword!2026",
    "mfaToken": "123456"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "user": {
      "id": "uuid",
      "email": "dispatcher@ems.gov",
      "fullName": "Chief Dispatcher",
      "role": "DISPATCHER"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### `POST /auth/invitations`
Generates a cryptographically random invitation token for privileged roles.
- **Access**: `DISPATCHER` or `SYSTEM_ADMIN`
- **Request Body**:
  ```json
  {
    "email": "medic.arun@ems.gov",
    "role": "AMBULANCE_CREW",
    "organizationId": "optional-uuid"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "message": "Privileged invitation generated successfully",
    "invitation": {
      "email": "medic.arun@ems.gov",
      "role": "AMBULANCE_CREW",
      "invitationToken": "d4e2f8...64-char-hex...",
      "expiresAt": "2026-10-30T10:00:00.000Z"
    }
  }
  ```

---

## 2. Emergency Case Endpoints

### `POST /emergencies`
Submits an emergency incident for atomic allocation.
- **Access**: Public / Authenticated
- **Rate Limit**: 10 requests / 5 minutes
- **Request Body**:
  ```json
  {
    "requesterName": "Ananya Raman",
    "requesterPhone": "+919876543210",
    "pickupLatitude": 13.0827,
    "pickupLongitude": 80.2707,
    "pickupAddress": "Block 4, Anna Nagar West, Chennai",
    "triagePriority": "CRITICAL_P1",
    "chiefComplaint": "Severe acute chest pain radiating to left arm",
    "patientAge": 54,
    "patientGender": "MALE",
    "idempotencyKey": "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "message": "Emergency case created successfully and dispatched for allocation",
    "case": {
      "id": "uuid",
      "caseNumber": "EMG-K9Z1-8241",
      "status": "PENDING",
      "triagePriority": "CRITICAL_P1"
    }
  }
  ```

### `GET /emergencies/track/:caseNumber`
Sanitized public tracking endpoint for callers.
- **Access**: Public
- **Response `200 OK`**: Returns current vehicle GPS, hospital destination, and milestone state without leaking private clinical notes.

### `PATCH /emergencies/:id/status`
Progresses operational milestone state.
- **Access**: `AMBULANCE_CREW`, `DISPATCHER`, `SYSTEM_ADMIN`
- **Request Body**:
  ```json
  {
    "status": "AT_SCENE",
    "notes": "Arrived on scene; patient conscious and oriented."
  }
  ```

---

## 3. GPS Telemetry Endpoints

### `POST /tracking/location`
Transmits real device GPS coordinates from authorized crew.
- **Access**: `AMBULANCE_CREW`, `DISPATCHER`, `SYSTEM_ADMIN`
- **Rate Limit**: 120 updates / minute (2Hz)
- **Request Body**:
  ```json
  {
    "ambulanceId": "ambulance-uuid",
    "latitude": 13.0850,
    "longitude": 80.2715,
    "accuracyMeters": 8.5,
    "speed": 45.2,
    "heading": 182,
    "deviceTimestamp": "2026-10-28T13:30:00.000Z"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "locationId": "uuid",
    "isSuspicious": false,
    "activeCaseId": "case-uuid"
  }
  ```

---

## 4. Real-Time WebSocket Events (Socket.IO)

Clients connect to `/` with JWT in `auth: { token: "..." }`.

### Emitted Events:
- `emergency:new`: New emergency logged into CAD queue.
- `emergency:assigned`: Ambulance allocated to emergency with ETA.
- `emergency:status_change`: Incident milestone update.
- `tracking:update`: Real-time GPS coordinates of active vehicle.
- `hospital:inbound_notice`: Alert to hospital trauma room.
- `hospital:response`: Hospital acceptance or diversion decision.
- `hospital:capacity_update`: Real-time bed availability change.
