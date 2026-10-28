# Complete Localhost Installation and Setup Guide

This guide provides step-by-step instructions to set up, configure, initialize, and run the **Concurrent Ambulance Allocation and Hospital Coordination System** locally on **Windows (PowerShell)** and **Linux / macOS (Bash)**.

---

## 1. Prerequisites and System Requirements

Ensure the following tools are installed on your workstation:

| Component | Minimum Version | Recommended Version | Verification Command |
|---|---|---|---|
| **Node.js** | `v20.x LTS` | `v22.x LTS` | `node -v` |
| **npm** | `v10.x` | `v11.x` | `npm -v` |
| **PostgreSQL** | `v14.x` | `v16.x` | `psql --version` or Docker |
| **Git** | `v2.40+` | Latest | `git --version` |
| **Docker (Optional)** | `v24+` | Latest with Docker Compose | `docker compose version` |

---

## 2. Option A: Native Local Installation (Windows PowerShell)

### Step 2.1: Clone and Navigate to Repository
```powershell
git clone <your-repository-url> "Ambulance-Akka"
cd "Ambulance-Akka"
```

### Step 2.2: Setup PostgreSQL Database
If PostgreSQL is installed locally:
1. Open PowerShell or SQL Shell (`psql`):
   ```sql
   CREATE DATABASE ambulance_db;
   CREATE USER postgres WITH ENCRYPTED PASSWORD 'postgres';
   GRANT ALL PRIVILEGES ON DATABASE ambulance_db TO postgres;
   ```
2. Verify PostgreSQL is listening on port `5432`:
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 5432
   ```

*Note: If you do not have native PostgreSQL installed, you can launch a lightweight PostgreSQL container via Docker:*
```powershell
docker run --name ambulance-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ambulance_db -p 5432:5432 -d postgres:16-alpine
```

### Step 2.3: Configure Environment Variables
Copy `.env.example` into `backend/.env`:
```powershell
Copy-Item ".env.example" "backend/.env"
```

Edit `backend/.env` if your database credentials or ports differ:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ambulance_db?schema=public"
JWT_SECRET="super-secret-production-grade-emergency-jwt-key-2026-secure"
JWT_EXPIRES_IN="8h"
CORS_ORIGIN="http://localhost:5173"
OSRM_ROUTING_URL="https://router.project-osrm.org"
ENABLE_RATE_LIMITING="true"
ADMIN_SETUP_TOKEN="emergency-admin-initial-setup-token-secure-2026"
```

### Step 2.4: Install Dependencies
Run from the project root:
```powershell
# Install root orchestration tools
npm install

# Install backend dependencies
cd backend
npm install
npm run prisma:generate

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### Step 2.5: Apply Database Migrations
Initialize the PostgreSQL schema using Prisma:
```powershell
cd backend
npm run prisma:migrate
# Or deploy existing schema:
npx prisma db push
cd ..
```

### Step 2.6: Bootstrap the Initial Administrator (Rule 1 Compliance)
In strict compliance with Rule 1 (No default passwords, demo logins, or seeded accounts), initialize your first system administrator interactively:
```powershell
cd backend
npm run seed:admin
```
You will be prompted for:
1. `ADMIN_SETUP_TOKEN` (matches the value in `.env`, e.g. `emergency-admin-initial-setup-token-secure-2026`)
2. Administrator Email
3. Administrator Full Name
4. Strong Password (minimum 12 characters with uppercase, lowercase, numbers, and symbols)

### Step 2.7: Run Unit and Concurrency Test Suite
Execute the automated test suite to verify concurrency control, GPS physics sanity, and RBAC:
```powershell
cd backend
npm test
cd ..
```

### Step 2.8: Start Development Servers
Open two terminal windows, or run from root:
```powershell
# Terminal 1: Backend API & WebSocket Server (Port 5000)
cd backend
npm run dev

# Terminal 2: Frontend Vite PWA (Port 5173)
cd frontend
npm run dev
```

Open your browser to: **`http://localhost:5173`**

---

## 3. Option B: Docker Compose Full Stack Setup

If Docker is available on your machine:
```powershell
# 1. Review environment settings
Copy-Item ".env.example" ".env"

# 2. Build and start all services (PostgreSQL, Backend, Frontend)
docker compose up --build -d

# 3. Check health status
docker compose ps

# 4. View logs in real-time
docker compose logs -f backend
```

Access:
- Frontend PWA: `http://localhost:80`
- Backend API: `http://localhost:5000/api/v1`
- Health Endpoint: `http://localhost:5000/health`

---

## 4. Initial Operational Walkthrough

Once running, test the 5 distinct operational roles:

1. **Public Emergency Requester (`/`)**:
   - Fill out an intake request (e.g. "Chest pain and difficulty breathing").
   - Click "Use My Current GPS" to acquire real browser coordinates.
   - Click "Dispatch Emergency Response Now".
   - You will be redirected to the **Live Incident Tracker**, showing the assigned vehicle, live GPS tracking, and destination hospital.

2. **Dispatcher Command Center (Click "Dispatcher CAD")**:
   - Inspect the real-time Leaflet map displaying active incident beacons, ambulance markers, and hospital trauma centers.
   - Review incoming emergency cases and triage priorities.
   - Use "Manual Dispatch Override" to reassign units if necessary.

3. **Ambulance Crew MDT (Click "Crew MDT")**:
   - Click "Start GPS Broadcast" to initiate real browser Geolocation API (`watchPosition`) telemetry stream.
   - Observe live accuracy (meters) and speed updates transmitted to the backend.
   - Transition milestones: "En Route Scene" -> "At Scene" -> "Transporting" -> "Patient Handover".
   - Fill in the formal clinical handover form (Receiving Doctor, Vitals, Narrative) to close the run.

4. **Hospital Staff Portal (Click "Hospital Staff")**:
   - View inbound patient triage notices with live OSRM turn-by-turn ETA.
   - Update standard and ICU bed capacity in real-time.
   - One-click "Accept Patient" or "Divert" with clinical justifications.

5. **Administrator & Audit Console (Click "Admin & Audit")**:
   - Generate cryptographic staff invitations for Paramedics, Dispatchers, and Doctors.
   - Add new ambulances or hospital facilities to the registry.
   - Inspect the tamper-resistant immutable operational audit trail.
