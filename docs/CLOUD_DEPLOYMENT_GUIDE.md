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

## 2. Option A: Zero-Docker Native Deployment (Render / Railway / Vercel) — RECOMMENDED

You **do not need Docker** to deploy this application. Cloud platforms like Render, Railway, and Vercel run Node.js natively.

### Step 2.1: Deploy Backend Web Service (Render / Railway)
1. In Render or Railway, click **New Web Service** and select your GitHub repository:
   `https://github.com/unfav72/Ambulance-Alert.git`
2. Configure settings:
   - **Environment / Runtime**: `Node` *(NOT Docker)*
   - **Root Directory**: `backend`
   - **Build Command**:
     ```bash
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
   - **Plan**: Free or Starter
3. Add **Environment Variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `5000` (or leave default on Render)
   - `DATABASE_URL`: `postgresql://app_user:...@db-host:5432/ambulance_prod?sslmode=require&connect_timeout=30` (e.g. Neon connection string)
   - `JWT_SECRET`: *(A random 64-character string)*
   - `JWT_EXPIRES_IN`: `8h`
   - `CORS_ORIGIN`: `*` *(or your frontend URL e.g. `https://your-frontend.onrender.com`)*
   - `OSRM_ROUTING_URL`: `https://router.project-osrm.org`
   - `ENABLE_RATE_LIMITING`: `true`
   - `ADMIN_SETUP_TOKEN`: *(A secure token for admin setup)*
   - `BREVO_API_KEY`: *(Your Brevo API Key)*
   - `BREVO_SENDER_EMAIL`: `vanakkam727@gmail.com`
   - `BREVO_SENDER_NAME`: `AmbulanceOps Emergency Dispatch`

4. Click **Deploy**. Render will install dependencies, generate the Prisma client, build TypeScript, and launch the server.

---

### Step 2.2: Deploy Frontend (Vercel or Render Static Site)

#### Method 1: Deploy on Render Static Site
1. In Render, click **New Static Site** and select `https://github.com/unfav72/Ambulance-Alert.git`.
2. Configure settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
3. Environment Variables:
   - `VITE_API_URL`: `https://your-backend-service.onrender.com`
4. Add Rewrite Rule (under "Redirects/Rewrites"):
   - Source: `/*`
   - Destination: `/index.html`
   - Action: `Rewrite`

#### Method 2: Deploy on Vercel
1. Import GitHub repository `https://github.com/unfav72/Ambulance-Alert.git`.
2. Set **Root Directory** to `frontend`.
3. Framework Preset: `Vite`.
4. Environment Variables:
   - `VITE_API_URL`: `https://your-backend-service.onrender.com`
5. Click **Deploy**.

---

### Step 2.3: Execute Database Sync & Bootstrap Admin (One-Time)
From your local terminal or via Render Shell:
```bash
# Push schema directly to your live database
npm --prefix backend run prisma:generate
npx prisma db push --schema=backend/prisma/schema.prisma

# Bootstrap administrator
npm --prefix backend run seed:admin
```

---

## 3. Option B: Docker Container Deployment (Render / Railway / VPS)

*(Use this ONLY if you prefer building container images)*

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
