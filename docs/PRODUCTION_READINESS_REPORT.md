# Honest Production Readiness & External Dependency Report

In strict compliance with Master Engineering Prompt Rule 10 (*"No claim that a system is secure, compliant, audited, or production-ready without evidence"*), this report details what has been verified, what external services are required, and what operational prerequisites remain before full field deployment.

---

## 1. Verified & Implemented Capabilities

The following components have been implemented and verified via automated test suites and production bundle builds:

| Capability | Verification Evidence | Status |
|---|---|:---:|
| **Concurrency-Safe Dispatch** | `tests/concurrency.test.ts` passes; atomic conditional row-level transitions prevent double-allocations under simultaneous load. | **Verified** |
| **GPS Telemetry Physics Sanity** | `tests/gps-validation.test.ts` passes; validates coordinate boundaries, max speed threshold (180 km/h), freshness window (<= 120s), and accuracy (<= 250m). | **Verified** |
| **Strict Role Authorization (RBAC)** | `tests/authorization.test.ts` passes; public registration strictly limited to `PATIENT_REQUESTER`; privileged roles require cryptographically hashed invitations. | **Verified** |
| **Idempotency Protection** | `tests/idempotency.test.ts` passes; duplicate UUID requests return existing incidents without creating duplicate dispatches. | **Verified** |
| **Hospital Capacity Integrity** | `tests/hospital-coordination.test.ts` passes; available beds cannot exceed total beds; clinical justifications required on diversion. | **Verified** |
| **PWA Service Worker & Manifest** | Production Vite build compiles; generates `sw.js` with explicit denial of `/api/` caching to protect sensitive health data. | **Verified** |

---

## 2. Required External Dependencies & Estimated Operational Costs

For real-world operational deployment, the following third-party infrastructure must be procured and configured:

| Dependency | Purpose | Recommended Enterprise Provider | Estimated Monthly Cost |
|---|---|---|---|
| **Managed PostgreSQL** | Persistent database with Multi-AZ replication & PITR backups | AWS RDS PostgreSQL (db.m6g.large) or Supabase Enterprise | $150 – $350 / month |
| **Dedicated Routing Service** | Turn-by-turn routes & traffic-aware ETA without public API throttling | Self-hosted OSRM on EC2 or OpenRouteService | $60 – $150 / month |
| **Identity Provider (OIDC)** | Enterprise SSO, MFA, and automated password recovery | Amazon Cognito, Auth0, or Microsoft Entra ID | $0 – $120 / month (tier based) |
| **SMS & Cellular Gateway** | Caller SMS dispatch notifications and verification codes | Twilio, AWS SNS, or Sinch | Pay-per-SMS (~$0.015 / SMS) |
| **Web Push Service** | Browser push notifications for incoming CAD alerts | Web Push Protocol with VAPID Key pair | Free (Infrastructure cost only) |
| **Domain & WAF** | DDoS mitigation, rate limiting, and Edge TLS termination | Cloudflare Enterprise or AWS CloudFront + WAF | $20 – $200 / month |

---

## 3. Remaining Regulatory, Security, & Operational Unmet Prerequisites

Before this software can be deployed as an official emergency dispatch service, the following requirements must be addressed:

### 3.1 PWA Background Geolocation Limitation
- **Finding**: Mobile operating systems (iOS Safari and Android Chrome) throttle or suspend background JavaScript execution when browser tabs are minimized or when the device screen is locked.
- **Remediation Requirement**: For continuous 24/7 vehicle tracking, ambulance fleet hardware should use either:
  1. An in-vehicle dedicated GPS hardware tracker (OBD-II / CAN-bus GPS module streaming over MQTT/HTTPS to `/api/v1/tracking/location`).
  2. A native or hybrid mobile application (React Native / Kotlin / Swift) with platform background location entitlements (`ACCESS_BACKGROUND_LOCATION`).

### 3.2 Healthcare Data Compliance (DISHA / HIPAA / GDPR)
- **Finding**: The system handles sensitive personal health information (chief complaints, patient age/gender, and clinical handover summaries).
- **Remediation Requirement**:
  - Implement encryption-at-rest with customer-managed keys (AWS KMS).
  - Complete formal third-party HIPAA / DISHA compliance audit.
  - Implement patient consent collection where legally required.

### 3.3 24/7 SRE & High-Availability SLA
- **Finding**: A life-critical dispatch application requires 99.999% ("five nines") availability. Free-tier cloud hosting platforms (which spin down on idle) are strictly prohibited for production dispatch.
- **Remediation Requirement**:
  - Multi-region failover configuration for backend and database.
  - PagerDuty or OpsGenie integration with a 24/7 on-call engineering escalation policy.
  - Automated database backup restoration drills conducted quarterly.
