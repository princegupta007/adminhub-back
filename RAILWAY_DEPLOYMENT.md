# Railway Backend Production Deployment Guide

**Project**: Miles Admin Hub API (`adminhub_back`)  
**Stack**: NestJS 12, Node.js 22, TypeScript, Prisma ORM, PostgreSQL 16, Docker  
**Platform**: Railway Cloud Platform  

---

## 1. Architecture

```text
                  +-----------------------------------+
                  |         Railway Project           |
                  |                                   |
Internet Traffic  |   +---------------------------+   |
==================+==>|   adminhub-backend        |   |
  (HTTPS / 443)   |   |   (NestJS Docker Image)   |   |
                  |   |   Port: ${{PORT}}         |   |
                  |   |   Host: 0.0.0.0           |   |
                  |   +-------------+-------------+   |
                  |                 | (Prisma TCP)    |
                  |                 v                 |
                  |   +---------------------------+   |
                  |   |   Railway PostgreSQL      |   |
                  |   |   Internal Port: 5432     |   |
                  |   +---------------------------+   |
                  +-----------------------------------+
```

* **No Extra Infrastructure**: The backend does NOT use Redis, BullMQ, Kafka, Elasticsearch, or standalone background workers. A single stateless NestJS container connected to PostgreSQL provides the complete backend service.

---

## 2. Railway Project Setup

1. Log into your [Railway Dashboard](https://railway.com).
2. Click **New Project** -> Select **Deploy from GitHub repo**.
3. Select the repository: `adminhub-back` (or `princegupta007/adminhub-back`).
4. Select the `main` branch.

---

## 3. PostgreSQL Database Setup

1. Inside your Railway project canvas, click **+ New** -> **Database** -> **Add PostgreSQL**.
2. Railway creates a managed PostgreSQL instance and exposes internal connection variables (`DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`).
3. Note the service name (typically `Postgres` or `PostgreSQL`).

---

## 4. Backend Service Setup

1. In the project canvas, select the `adminhub-back` service.
2. In the **Settings** tab:
   * **Build**:
     * **Builder**: Dockerfile (Railway detects the root `Dockerfile` automatically).
     * **Dockerfile Path**: `/Dockerfile`
   * **Deploy**:
     * **Pre-Deploy Command**: `npx prisma migrate deploy`
     * **Start Command**: Leave blank (uses Dockerfile CMD: `node dist/main.js`).
     * **Restart Policy**: `On failure` (Max retries: 10).
   * **Networking**:
     * Click **Generate Domain** to provision a public URL (e.g. `https://adminhub-backend-production.up.railway.app`).

---

## 5. Environment Variables Configuration

Navigate to the **Variables** tab of the `adminhub-back` service and set the following:

```ini
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=82d231d4c3e42bbe86857c701b649d3f6cdf811e14c2115c7437baf9b7280d2281b8f141be5ce41c78bd6b928737a98379909956148bd2d5dd3d1c196ef17bb1
JWT_EXPIRES_IN=1d
CORS_ORIGIN=https://miles-flax.vercel.app
THROTTLE_TTL=60
THROTTLE_LIMIT=100
LOGIN_THROTTLE_LIMIT=5
SWAGGER_ENABLED=false
RUN_MIGRATIONS=true
```

> **Security Note**: Never commit your real `JWT_SECRET` to Git. Generate a unique secret using:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

## 6. Docker Configuration

The production [Dockerfile](file:///e:/projects/adminhub_back/Dockerfile) utilizes an optimized 4-stage multi-stage Alpine build:

* **Stage 1 (`base`)**: Node 22 Alpine with OpenSSL and `dumb-init`.
* **Stage 2 (`dependencies`)**: Copies package files and Prisma schema, executes `npm ci --legacy-peer-deps` and `npx prisma generate`.
* **Stage 3 (`builder`)**: Copies `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, and `src/`. Runs `npm run build` (`nest build`) and `npm prune --omit=dev`.
* **Stage 4 (`runner`)**: Runs as unprivileged non-root user `node`. Copies built `dist/`, production `node_modules/`, `prisma/`, and `scripts/docker-entrypoint.sh`.

---

## 7. Build Command

* **Railway Build**: Managed automatically by the root `Dockerfile`.
* **Local CLI Build**:
  ```bash
  npm run build
  ```
  Verified entry point: `dist/main.js`.

---

## 8. Pre-Deploy Migration Command

Configure in Railway **Deploy** -> **Pre-Deploy Command**:
```bash
npx prisma migrate deploy
```
This runs strictly before new container instances receive incoming traffic. If a database migration fails, Railway aborts the deployment without routing traffic to broken schema states.

---

## 9. Start Command

* Handled by Dockerfile CMD:
  ```bash
  node dist/main.js
  ```
* Wrapped with `dumb-init` via [docker-entrypoint.sh](file:///e:/projects/adminhub_back/scripts/docker-entrypoint.sh) for proper Linux signal forwarding (SIGTERM / SIGINT).

---

## 10. Healthcheck Configuration

* In Railway **Settings** -> **Healthcheck Path**:
  ```text
  /health
  ```
* **Failure Threshold**: 3
* **Timeout**: 10s
* **Expected Response**: HTTP 200 OK:
  ```json
  {
    "status": "ok",
    "uptime": 12.4,
    "timestamp": "2026-10-06T17:53:58.411Z"
  }
  ```

---

## 11. Domain Configuration

* Under **Networking** -> **Public Networking**, click **Generate Domain** or configure your custom domain (e.g., `api.yourdomain.com`).
* Ensure your frontend application's `NEXT_PUBLIC_API_URL` or `VITE_API_URL` points to this public HTTPS URL with prefix `/api/v1` (e.g. `https://adminhub-backend-production.up.railway.app/api/v1`).

---

## 12. Migration Process

1. Schema changes are developed locally using `npx prisma migrate dev --name <migration_name>`.
2. Generated SQL files are committed to `prisma/migrations/`.
3. In production, migrations are executed exclusively with:
   ```bash
   npx prisma migrate deploy
   ```
4. **NEVER** run `npx prisma db push` or `npx prisma migrate dev` in production.

---

## 13. Production Seed Policy

* **MIGRATIONS**: `YES` (Mandatory).
* **SEED**: `NO` (Default).
* **Policy**: Production deployment must NEVER automatically execute `npx prisma db seed`. Synthetic demo users, mock transactions, and mock bookings must remain strictly in local/staging environments.
* **Initial Super Admin Provisioning**: When deploying to a brand new production database, provision an initial super administrator account through one of these secure methods:
  1. Railway CLI: `railway run npm run prisma:seed` (if demo data is accepted for initial staging).
  2. One-off SQL command via Railway PostgreSQL query editor or `psql` to insert an initial admin with a bcrypt-hashed password.

---

## 14. Logs & Observability

* Inspect live application logs in Railway's **Deployments** -> **View Logs** tab.
* Look for:
  ```text
  🌟 [Miles Admin API] Container startup initiated...
  🚀 [Miles Admin API] Running pending database migrations (prisma migrate deploy)...
  ✅ [Miles Admin API] Database migrations executed successfully.
  [Nest] LOG [Bootstrap] Miles Admin Hub API running on http://0.0.0.0:4000
  ```
* All error responses are filtered: stack traces and sensitive connection parameters are suppressed in production.

---

## 15. Restart Procedure

1. In Railway Dashboard, select the `adminhub-back` service.
2. Click the three dots `...` in the top-right corner -> Click **Restart**.
3. Railway sends `SIGTERM` to the container. `dumb-init` forwards the signal to Node.js, triggering NestJS `enableShutdownHooks()` and `PrismaService.$disconnect()`.

---

## 16. Rollback Procedure

1. In Railway Dashboard, open the **Deployments** tab.
2. Locate the previous stable green deployment commit.
3. Click the three dots `...` on that deployment -> Click **Redeploy**.
4. Railway instantly rolls back container routing to the previously built image artifact.

---

## 17. Backup Assumptions

> [!WARNING]
> **BACKUP STATUS**: VERIFY IN RAILWAY PROJECT  
> **RESTORE TEST**: NOT EXECUTED unless actually performed in the live Railway environment.  
> Do not assume backups are automatically taken. In Railway PostgreSQL, configure automated backup snapshots under database **Backups** tab before writing production financial data.

---

## 18. Troubleshooting Guide

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **Container crashes on boot with `DATABASE_URL is a required environment variable`** | `DATABASE_URL` not linked from Postgres service. | In Railway Variables, add `DATABASE_URL=${{Postgres.DATABASE_URL}}`. |
| **Healthcheck fails with 503** | Database ping failed on `/health/ready`. | Point Railway Healthcheck Path specifically to `/health` (process liveness). |
| **CORS errors in browser** | Frontend origin does not match `CORS_ORIGIN`. | Ensure `CORS_ORIGIN` matches frontend origin exactly (no trailing slash). |
| **Login returns 429 Too Many Requests** | Exceeded `LOGIN_THROTTLE_LIMIT` (5 attempts per 60s). | Wait 60s or adjust `LOGIN_THROTTLE_LIMIT` in Railway variables. |

---

## 19. Production Smoke-Test Commands

Run these smoke tests against your deployed Railway domain:

```bash
# 1. Process Liveness Check (Expected: 200 OK)
curl -i https://<your-railway-domain>/health

# 2. API Versioned Health Check (Expected: 200 OK)
curl -i https://<your-railway-domain>/api/v1/health

# 3. Database Dependency Readiness Check (Expected: 200 OK)
curl -i https://<your-railway-domain>/health/ready

# 4. Admin Authentication Login (Expected: 200 OK with accessToken)
curl -i -X POST https://<your-railway-domain>/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@miles.io","password":"YourAdminPassword123!"}'

# 5. Protected Endpoint Verification (Expected: 200 OK)
curl -i https://<your-railway-domain>/api/v1/dashboard \
  -H "Authorization: Bearer <accessToken>"

# 6. Unauthenticated Protection Check (Expected: 401 Unauthorized)
curl -i https://<your-railway-domain>/api/v1/users
```
