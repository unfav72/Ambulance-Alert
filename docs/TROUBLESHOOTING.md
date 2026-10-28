# Operational Troubleshooting & Diagnostics Guide

This guide provides fast diagnosis and resolution steps for common local and production issues.

---

## 1. Database Connection Failures (`ECONNREFUSED 5432`)

### Symptom
Backend outputs:
```
[ERROR] Database connection check failed: Can't reach database server at localhost:5432
```

### Remediation Steps
1. Verify PostgreSQL service status:
   - On Windows: Run `Get-Service *postgres*` in PowerShell.
   - On Linux: Run `sudo systemctl status postgresql`.
   - On Docker: Run `docker ps` to verify `ambulance_postgres` is healthy.
2. Check `.env` configuration:
   Ensure `DATABASE_URL` matches your local credentials and database name:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ambulance_db?schema=public"
   ```
3. Run Prisma health check:
   ```bash
   cd backend
   npx prisma db push
   ```

---

## 2. GPS Location Telemetry Rejection (`400 TELEMETRY_REJECTED`)

### Symptom
Crew MDT displays: `GPS timestamp rejected: Observation is either stale (>120s) or in future (>15s)` or `GPS accuracy exceeds operational threshold`.

### Cause & Remediation
1. **Clock Desynchronization**:
   The device clock differs from the server clock by more than 15 seconds. Synchronize device time with NTP:
   - Windows: `w32tm /resync`
   - Linux: `sudo timedatectl set-ntp true`
   - Android / iOS: Settings -> Date & Time -> Set Automatically.
2. **Poor Satellite Fix**:
   Accuracy reading exceeds 250 meters (indoor or underground). Move device near window or outdoors to establish satellite lock.
3. **Uncrewed Vehicle**:
   The crew account does not have an `ACTIVE` shift assignment on the target vehicle. Dispatcher must assign the crew via CAD before telemetry is permitted.

---

## 3. OSRM Routing Fallback Banner Displayed

### Symptom
Dispatcher or caller interface displays: `Route provider offline. ETA estimated via direct geodesic vector at 40 km/h`.

### Cause & Remediation
- Public demo OSRM (`router.project-osrm.org`) has rate limits or experienced high network latency.
- The system automatically engages Rule 10 fallback logic: computes geodesic Haversine distance and conservative emergency vehicle ETA without inventing fake routes.
- **Production Fix**: Deploy a dedicated self-hosted OSRM container or set `OSRM_ROUTING_URL` to an enterprise provider endpoint in `.env`.

---

## 4. Socket.IO Disconnection / Reconnecting Loop

### Symptom
Top navigation bar displays `Connecting...` in red.

### Remediation Steps
1. Check browser console network tab for WebSocket handshake (`/socket.io/?EIO=4&transport=websocket`).
2. Verify reverse proxy configuration: Nginx or ALB must support `Upgrade: websocket` and `Connection: Upgrade` headers.
3. Check authentication token: If JWT expired, sign out and sign back in to refresh token.
