# Production Deployment & Operations Guide

> **Module:** Production Hardening, Docker & Deployment (Phase 9)  
> **Target Runtime:** Node.js 22 LTS / Alpine Linux in Containerized Environments  
> **Database:** PostgreSQL 16 with Prisma ORM Migrations

---

## 1. Overview & Architecture

The **Miles Admin Hub API** is designed for modern containerized cloud deployments (Docker, Docker Compose, Kubernetes, AWS ECS, Google Cloud Run, Azure Container Apps).

```text
       ┌────────────────────────┐
       │     Load Balancer      │
       └───────────┬────────────┘
                   │
         Readiness Probe (/health/ready)
                   │
                   ▼
       ┌────────────────────────┐
       │   Miles API Container  │
       │    (Node 22 Alpine)    │
       │  Non-root: user node   │
       │  PID 1: dumb-init      │
       └───────────┬────────────┘
                   │
         PostgreSQL Connection Pool
                   │
                   ▼
       ┌────────────────────────┐
       │   PostgreSQL Database  │
       │      (Postgres 16)     │
       └────────────────────────┘
```

### Key Production Characteristics:
1. **Multi-Stage Container Image:** Separates build dependencies (`node_modules` with devDependencies) from the lean runtime container (`node:22-alpine` with `openssl` and `dumb-init`).
2. **Principle of Least Privilege:** Runs strictly as unprivileged non-root user `USER node`.
3. **Signal Forwarding & Graceful Termination:** Utilizes `dumb-init` to handle PID 1 signal forwarding (SIGTERM / SIGINT), triggering NestJS and Prisma connection pool teardown.
4. **Deterministic Migration Gate:** Database migrations execute safely via `prisma migrate deploy` prior to application bootstrap; failures prevent corrupt schema execution.
5. **Decoupled Probes:** Distinct endpoints for process liveness (`/health/live`) and database readiness (`/health/ready`).

---

## 2. Environment Configuration Reference

All application settings are managed via environment variables and validated at startup using Joi:

| Variable | Required | Default | Description & Security Guidelines |
|---|---|---|---|
| `NODE_ENV` | Optional | `development` | Runtime environment: `development`, `production`, `test`. In production, Swagger and verbose logging are restricted. |
| `PORT` | Optional | `4000` | Port on which the HTTP server listens. |
| `HOST` | Optional | `0.0.0.0` | Host interface binding. Default `0.0.0.0` ensures container accessibility. |
| `DATABASE_URL` | **Required** | None | PostgreSQL connection string. Must use a pooled connection in high-concurrency environments. |
| `JWT_SECRET` | **Required** | None | Cryptographic secret for signing Bearer JWTs. Must be minimum 16 characters (32+ chars strongly recommended). |
| `JWT_EXPIRES_IN` | Optional | `1d` | Expiration lifespan of issued access tokens (e.g. `1d`, `12h`, `30m`). |
| `FRONTEND_URL` | **Required** | None | Comma-separated list of allowed CORS browser origins (e.g. `https://miles-flax.vercel.app,http://localhost:3000`). |
| `THROTTLE_TTL` | **Required** | `60` | Rate limiter window in seconds. |
| `THROTTLE_LIMIT` | **Required** | `100` | Maximum general requests allowed per IP within the TTL window. |
| `LOGIN_THROTTLE_LIMIT` | **Required** | `5` | Maximum login attempts allowed per IP per minute (brute-force defense). |
| `SWAGGER_ENABLED` | Optional | `true` (dev) / `false` (prod) | Explicitly enables or disables the Swagger UI at `/api/docs`. |
| `RUN_MIGRATIONS` | Optional | `true` | When set to `true`, container entrypoint automatically executes `prisma migrate deploy` upon boot. |

---

## 3. Docker Containerization

### 3.1. Building the Production Image
```bash
docker build -t miles-admin-api:latest .
```

The multi-stage build progresses through 4 isolated stages:
- **`base`**: Node 22 Alpine with required system libraries (`openssl` for Prisma query engine, `dumb-init` for signal management).
- **`dependencies`**: Performs `npm ci` and `npx prisma generate` to construct native Prisma client bindings.
- **`builder`**: Compiles TypeScript source to NodeNext ESM via `npm run build` and prunes development packages (`npm prune --omit=dev`).
- **`runner`**: Final minimal image copying only `dist/`, production `node_modules/`, `prisma/`, and startup scripts.

### 3.2. Running Standalone Container
```bash
docker run -d \
  --name miles-admin-api \
  -p 4000:4000 \
  --env-file .env \
  miles-admin-api:latest
```

---

## 4. Docker Compose Deployment

A production-ready `docker-compose.yml` is provided at the repository root:

```bash
# Start both PostgreSQL and Miles Admin API
docker compose up -d

# View container logs
docker compose logs -f api

# Stop all services gracefully
docker compose down
```

### Dependency & Healthcheck Order:
The `api` container specifies:
```yaml
depends_on:
  postgres:
    condition: service_healthy
```
This guarantees that PostgreSQL is fully accepting connections (`pg_isready`) before the API container initiates migrations and starts listening for HTTP traffic.

---

## 5. Database Migration & Deployment Strategy

Production database changes strictly adhere to the **Prisma Migration History**:
- `prisma db push` is **strictly prohibited** in production to prevent unintended data loss.
- All schema changes must be applied via `prisma migrate deploy`.

### Execution Paths:
1. **Automatic via Container Entrypoint:**
   `scripts/docker-entrypoint.sh` executes `npx prisma migrate deploy` on container startup when `RUN_MIGRATIONS=true`.
2. **Manual or CI/CD Pipeline:**
   Execute directly using the deterministic migration runner:
   ```bash
   npm run migrate:deploy
   # or
   node scripts/run-migrations.cjs
   ```

### Migration Failure Safeguard:
If any migration fails (due to network disruption, locking conflict, or database constraint), the entrypoint script exits immediately with exit code `1`. The application process does **not** start, preventing the service from serving traffic against an incompatible schema.

---

## 6. Health, Liveness & Readiness Probes

The application provides specialized endpoints designed for cloud load balancers and orchestrators:

| Probe Route | Target Use Case | Verification Logic | HTTP Status Codes |
|---|---|---|---|
| `GET /health/live`<br>`GET /api/v1/health/live` | **Kubernetes Liveness Probe** / Container Healthcheck | Confirms the Node.js event loop is alive and responding. | `200 OK` |
| `GET /health/ready`<br>`GET /api/v1/health/ready` | **Kubernetes Readiness Probe** / Load Balancer Target | Executes fast PostgreSQL ping (`SELECT 1`). | `200 OK` (connected)<br>`503 Service Unavailable` (disconnected) |
| `GET /health`<br>`GET /api/v1/health` | **General Heartbeat** | Process uptime and timestamp; backward-compatible. | `200 OK` |

### Security & Sanitization:
Readiness failure payloads strictly sanitize internal error details:
```json
{
  "status": "error",
  "database": "disconnected",
  "uptime": 128.4,
  "timestamp": "2026-10-06T14:00:00.000Z"
}
```
Database credentials, connection strings, hostnames, and stack traces are **never** exposed in probe responses.

---

## 7. Security Hardening Controls

1. **Helmet HTTP Headers:** Protects against MIME sniffing (`X-Content-Type-Options: nosniff`), clickjacking (`X-Frame-Options: SAMEORIGIN`), and XSS attacks.
2. **Strict CORS Whitelist:** Only browser origins explicitly declared in `FRONTEND_URL` are permitted to execute cross-origin requests.
3. **Two-Tier Rate Limiting:** Global rate limiting (100 req/min) prevents denial-of-service, while strict authentication throttling (5 req/min) mitigates credential stuffing.
4. **Graceful Shutdown:** `app.enableShutdownHooks()` ensures database connection pools close cleanly without dropping in-flight transactions.
5. **No Stack Trace Leakage:** Centralized `AllExceptionsFilter` catches unhandled exceptions, logs internally with request context, and returns sanitized RFC 7807 error envelopes.
