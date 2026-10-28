# Production Cloud Deployment Guide

This guide covers deployment to production environments:
1. **Managed Container Platform** (Render / Railway / DigitalOcean App Platform)
2. **Enterprise Cloud Infrastructure** (AWS ECS Fargate + AWS RDS PostgreSQL)
3. **Dedicated Linux VPS** (Ubuntu 24.04 LTS + Docker + Nginx SSL)

---

## 1. Production Architecture Overview

```
                      [ Public HTTPS / WSS Traffic ]
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │ Cloudflare / AWS CloudFront  │ (DDoS Protection, WAF, Edge SSL)
                     └──────────────┬───────────────┘
                                    │
                     ┌──────────────▼───────────────┐
                     │  Reverse Proxy / Ingress     │ (Nginx / ALB with SSL Termination)
                     └──────┬────────────────┬──────┘
                            │                │
            ┌───────────────▼──────┐  ┌──────▼───────────────┐
            │ Frontend PWA         │  │ Backend API Server   │
            │ (Static CDN / Nginx) │  │ (Node.js / Socket.IO)│
            └──────────────────────┘  └──────┬───────────────┘
                                             │
                                      ┌──────▼───────────────┐
                                      │ Managed PostgreSQL   │ (AWS RDS / Supabase PG)
                                      │ Multi-AZ + Daily WAL │
                                      └──────────────────────┘
```

---

## 2. Option A: Managed Cloud Deployment (Render / Railway / Supabase)

### Step 2.1: Provision Managed PostgreSQL
1. Create a PostgreSQL instance on **AWS RDS**, **Supabase**, or **Neon**.
2. Note the connection URI:
   ```
   postgresql://app_user:StrongPassword@db-host.provider.com:5432/ambulance_prod?sslmode=require
   ```
3. Ensure automated daily backups and Point-In-Time Recovery (PITR) are enabled.

### Step 2.2: Deploy Backend Web Service
1. Connect your Git repository (`https://github.com/unfav72/Ambulance-Alert.git`) to **Render** or **Railway**.
2. **Build Configuration**:
   - **Build Context / Root Directory**: `.` (repository root)
   - **Dockerfile Path**: `docker/Dockerfile.backend`
   - *(Note: If you choose Root Directory: `backend`, select `Dockerfile` inside the backend directory)*
3. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `DATABASE_URL`: `postgresql://app_user:...@db-host:5432/ambulance_prod?sslmode=require&connect_timeout=30`
   - `JWT_SECRET`: *(Generate 64-character random string via `openssl rand -hex 32`)*
   - `JWT_EXPIRES_IN`: `8h`
   - `CORS_ORIGIN`: `https://ambulance.yourdomain.com`
   - `OSRM_ROUTING_URL`: `https://router.project-osrm.org`
   - `ENABLE_RATE_LIMITING`: `true`
   - `ADMIN_SETUP_TOKEN`: *(Generate secure 32-char token)*
   - `BREVO_API_KEY`: `xkeysib-...`
   - `BREVO_SENDER_EMAIL`: `vanakkam727@gmail.com`
   - `BREVO_SENDER_NAME`: `"AmbulanceOps Emergency Dispatch"`

### Step 2.3: Deploy Frontend PWA Static Service
1. Create a Web Service using `docker/Dockerfile.frontend` with Root Directory: `.`
2. Configure custom domain with automatic SSL (e.g., `https://ambulance.yourdomain.com`).
3. Set proxy rule: forward `/api/` and `/socket.io/` to your deployed backend URL.

### Step 2.4: Execute Production Migrations & Bootstrap Administrator
Open SSH or terminal console in the backend container:
```bash
# Run schema migration
npx prisma migrate deploy

# Bootstrap production administrator
npm run seed:admin
```

---

## 3. Option B: Enterprise AWS Cloud Deployment

### 3.1 Components
- **Networking**: VPC across 2 Availability Zones, Public & Private Subnets.
- **Database**: AWS RDS PostgreSQL 16 (Multi-AZ, Encrypted EBS volume, Private Subnet).
- **Compute**: AWS ECS (Elastic Container Service) with Fargate serverless tasks.
- **Load Balancer**: AWS Application Load Balancer (ALB) with ACM TLS certificate and WebSocket support.
- **Storage**: AWS Secrets Manager for `DATABASE_URL` and `JWT_SECRET`.

### 3.2 Step-by-Step AWS Setup
1. **Push Container Images to AWS ECR (Elastic Container Registry)**:
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com

   docker build -t ambulance-backend -f docker/Dockerfile.backend ./backend
   docker tag ambulance-backend:latest <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/ambulance-backend:latest
   docker push <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/ambulance-backend:latest
   ```

2. **Configure ECS Task Definition**:
   - Task CPU: 1024 (1 vCPU), Memory: 2048 (2 GB)
   - Reference RDS credentials securely via AWS Secrets Manager ARN.
   - Configure health check: `http://localhost:5000/health`.

3. **Configure Application Load Balancer (ALB)**:
   - Target Group: Port 5000, Protocol HTTP.
   - Enable stickiness for WebSocket sessions on path `/socket.io/*`.
   - Forward HTTPS (443) with TLS 1.3 policy `ELBSecurityPolicy-TLS13-1-2-2021-06`.

---

## 4. Option C: Dedicated Linux VPS (Ubuntu 24.04 LTS)

### Step 4.1: Server Hardening & Firewall Setup
```bash
# Update OS packages
sudo apt update && sudo apt upgrade -y

# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Step 4.2: Deploy Application
```bash
git clone <repo-url> /opt/ambulance-system
cd /opt/ambulance-system

# Create production .env
cp .env.example .env
nano .env # Set production secrets and database password

# Start services
docker compose -f docker-compose.yml up -d --build
```

### Step 4.3: Secure with Let's Encrypt SSL & Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d ambulance.yourdomain.com
```

---

## 5. Security & Operational Checklist Prior to Go-Live

- [ ] **Secret Rotation**: Ensure `JWT_SECRET` and `ADMIN_SETUP_TOKEN` are distinct from repository defaults.
- [ ] **HTTPS Enforced**: HTTP strictly redirects to HTTPS (301 Moved Permanently).
- [ ] **Rate Limiting Active**: Verify rate limiters block > 10 failed login attempts within 15 minutes.
- [ ] **CORS Restricted**: CORS origin restricted to exact operational domain.
- [ ] **Database Backups Verified**: Automated test restoration of RDS/PostgreSQL backup executed and documented.
- [ ] **PWA Standalone Verified**: Web app manifest valid; service worker active without caching API responses.
- [ ] **Routing Service SLA**: Private OSRM or OpenRouteService instance evaluated for operational capacity.
