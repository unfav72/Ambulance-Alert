# Concurrent Ambulance Allocation and Hospital Coordination System (PWA)

[![Emergency Operations CI Pipeline](https://github.com/emergency-ops/ambulance-akka-system/actions/workflows/ci.yml/badge.svg)](https://github.com/emergency-ops/ambulance-akka-system/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.0-blue.svg)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.22-darkblue.svg)](https://www.prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-cyan.svg)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Installable-orange.svg)](https://web.dev/progressive-web-apps/)

A production-grade, database-backed Progressive Web Application for mission-critical emergency ambulance allocation, live GPS fleet telemetry, and hospital trauma bed coordination.

---

## 1. Absolute Implementation Rules (Compliance Summary)

This project strictly adheres to the Master Engineering Prompt rules:

1. **No Demo Accounts or Hardcoded Credentials**: Public registration creates only `PATIENT_REQUESTER` accounts. Privileged accounts (Crew, Hospital Staff, Dispatcher, Admin) must be provisioned via cryptographically random invitation tokens. Initial administrator is initialized via secure CLI (`npm run seed:admin`).
2. **No Hardcoded Operational Data**: Every ambulance, hospital facility, bed count, and emergency record is persisted and queried from PostgreSQL via Prisma ORM.
3. **No Simulated GPS in Production**: Crew MDT streams real GPS telemetry using the browser's `navigator.geolocation.watchPosition` API. Telemetry is verified for coordinate boundaries, freshness window (<= 120s), and vehicle velocity physics (<= 180 km/h).
4. **Backend-Enforced Authorization**: All route access, role verification, and organization scoping are enforced at the server middleware layer (`requireRoles`).
5. **ACID Concurrency-Safe Allocation**: Database transactions with conditional row-level transitions (`UPDATE Ambulance SET status = 'DISPATCHED' WHERE id = $1 AND status = 'AVAILABLE'`) prevent race conditions and eliminate double-allocations under simultaneous emergency submissions.
6. **No Fabricated Hospital Capacity**: Capacities must be updated by verified hospital staff or synchronized integrations with observation timestamps recorded.
7. **PWA Background Telemetry Safeguards**: Explicitly flags operating system background suspension when mobile browsers minimize or lock screen.
8. **Controlled PWA Caching**: Service worker caches static assets and map tiles while strictly denying caching of `/api/*` endpoints to protect sensitive health data.

---

## 2. Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Leaflet 1.9.4.
- **PWA**: Web App Manifest, Service Worker (Vite PWA / Workbox), Installable standalone mode.
- **Backend**: Node.js 22 LTS, Express, TypeScript.
- **Database**: PostgreSQL 16 with Prisma ORM and version-controlled migrations.
- **Real-Time Layer**: Authenticated Socket.IO with role-restricted rooms.
- **Validation**: Strict server-side Zod schema validation on all inputs.
- **Routing & ETA**: OSRM (Open Source Routing Machine) with geodesic fallback and provider health telemetry.
- **Testing**: Vitest automated test suites for concurrency, authorization, GPS validation, and idempotency.

---

## 3. Quick Start (Localhost Setup)

### Prerequisites
- Node.js `v20+` or `v22+`
- PostgreSQL `v14+` or Docker

### Installation Commands (Windows PowerShell)
```powershell
# 1. Install dependencies
npm run install:all

# 2. Configure environment
Copy-Item ".env.example" "backend/.env"

# 3. Generate Prisma client & apply database schema
npm run prisma:generate
npm run prisma:migrate # or npx prisma db push inside backend

# 4. Bootstrap initial system administrator
npm run seed:admin

# 5. Run automated test suite
npm test

# 6. Start development servers
npm run dev
```

Visit: **`http://localhost:5173`**

*(For detailed Windows, macOS, and Linux setup steps, refer to [docs/LOCAL_INSTALLATION_GUIDE.md](docs/LOCAL_INSTALLATION_GUIDE.md))*

---

## 4. Production Cloud Deployment

### Full-Stack Docker Compose
```bash
cp .env.example .env
docker compose up -d --build
```
- Frontend: `http://localhost:80`
- Backend API: `http://localhost:5000/api/v1`
- Health Endpoint: `http://localhost:5000/health`

*(For AWS ECS Fargate, RDS PostgreSQL, and Render/Railway deployments, refer to [docs/CLOUD_DEPLOYMENT_GUIDE.md](docs/CLOUD_DEPLOYMENT_GUIDE.md))*

---

## 5. Automated Verification Test Suite

Run the full automated test suite verifying core system invariants:
```bash
npm --prefix backend test
```

### Verified Test Cases:
- `tests/concurrency.test.ts`: Verifies mutual exclusion under simultaneous dispatch requests, proving zero double-allocations and automatic escalation when fleet capacity is exhausted.
- `tests/gps-validation.test.ts`: Verifies coordinate bounds, velocity limits (180 km/h), accuracy thresholds (<= 250m), and timestamp freshness.
- `tests/authorization.test.ts`: Verifies token signature checks, password complexity enforcement, and prevention of role tampering during public registration.
- `tests/idempotency.test.ts`: Verifies duplicate request suppression via UUID idempotency keys.
- `tests/hospital-coordination.test.ts`: Verifies bed capacity integrity (available beds <= total beds) and mandatory clinical diversion justification.

---

## 6. Project Architecture & Documentation Index

- [System Architecture & Sequence Diagrams](docs/ARCHITECTURE.md)
- [Localhost Installation Guide](docs/LOCAL_INSTALLATION_GUIDE.md)
- [Cloud Deployment Guide](docs/CLOUD_DEPLOYMENT_GUIDE.md)
- [REST API & WebSocket Documentation](docs/API_DOCUMENTATION.md)
- [RBAC Role & Permission Matrix](docs/ROLE_PERMISSION_MATRIX.md)
- [STRIDE Security Threat Model](docs/THREAT_MODEL.md)
- [Production Readiness & External Dependencies Report](docs/PRODUCTION_READINESS_REPORT.md)
- [Operational Troubleshooting Guide](docs/TROUBLESHOOTING.md)

---

## 7. License

Emergency Operations Engineering Core. Proprietary / Authorized Operational Deployment Only.
