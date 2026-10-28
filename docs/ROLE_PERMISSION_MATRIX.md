# Role-Based Access Control (RBAC) & Permission Matrix

The application strictly enforces role-based access control at the server middleware boundary (`requireRoles`). Public registration grants exclusively the `PATIENT_REQUESTER` role. All privileged operational accounts must be provisioned via signed invitations.

---

## 1. Role and Capability Matrix

| Feature / Endpoint | Patient / Requester | Ambulance Crew (Paramedic/Driver) | Hospital Staff | CAD Dispatcher | System Administrator |
|---|:---:|:---:|:---:|:---:|:---:|
| **Public Emergency Intake** (`POST /emergencies`) | Yes | Yes | Yes | Yes | Yes |
| **Track Own Case** (`GET /emergencies/track/:num`) | Yes | Yes | Yes | Yes | Yes |
| **View Unaffiliated Cases** (`GET /emergencies`) | **No** (Own cases only) | **No** (Assigned cases only) | **No** (Inbound coordinated cases only) | **Yes** (All) | **Yes** (All) |
| **Transmit GPS Telemetry** (`POST /tracking/location`) | **No** | **Yes** (Active shift vehicle only) | **No** | **Yes** | **Yes** |
| **Update Case Status** (`PATCH /emergencies/:id/status`) | **No** | **Yes** (Milestone progression) | **No** | **Yes** | **Yes** |
| **Manual Dispatch Override** (`POST /allocate-manual`) | **No** | **No** | **No** | **Yes** (Audited) | **Yes** (Audited) |
| **Update Bed Capacity** (`PUT /hospitals/:id/capacity`) | **No** | **No** | **Yes** (Affiliated hospital only) | **No** | **Yes** |
| **Accept / Divert Patient** (`POST /respond`) | **No** | **No** | **Yes** (Affiliated hospital only) | **Yes** | **Yes** |
| **Clinical Handover** (`POST /handover`) | **No** | **Yes** | **Yes** | **Yes** | **Yes** |
| **Register Ambulances** (`POST /ambulances`) | **No** | **No** | **No** | **Yes** | **Yes** |
| **Assign Crew Shifts** (`POST /ambulances/shifts`) | **No** | **No** | **No** | **Yes** | **Yes** |
| **Register Hospitals** (`POST /hospitals`) | **No** | **No** | **No** | **No** | **Yes** |
| **Generate Staff Invites** (`POST /auth/invitations`) | **No** | **No** | **No** | **Yes** | **Yes** |
| **View Immutable Audit Logs** (`GET /admin/audit-logs`) | **No** | **No** | **No** | **Yes** (Read-only) | **Yes** (Full) |
| **Account Lifecycle & Suspension** (`PATCH /admin/users/:id`) | **No** | **No** | **No** | **No** | **Yes** |

---

## 2. Organization Isolation Rules

1. **Hospital Staff Isolation**:
   - Hospital users have an associated `organizationId`.
   - Middleware and query filters restrict hospital staff to viewing and modifying only the capacity, inbound notices, and patient handovers associated with their verified organization.
   - Cross-facility data access returns `403 FORBIDDEN` and emits a security audit event.

2. **Ambulance Crew Shift Scoping**:
   - A paramedic or driver may only broadcast GPS telemetry for an ambulance if an `ACTIVE` shift assignment exists in `CrewAssignment`.
   - Attempts to broadcast location for unassigned vehicles are blocked and flagged as suspicious.

3. **Data Minimization for Public Tracking**:
   - The public case tracking endpoint (`GET /emergencies/track/:caseNumber`) returns only essential telemetry: assigned vehicle call sign, vehicle latitude/longitude, destination hospital name, and estimated ETA.
   - Private clinical narratives, paramedic personal phone numbers, and internal audit logs are excluded from public responses.
