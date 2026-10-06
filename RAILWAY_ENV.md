# Railway Environment Variables Reference

**Project**: Miles Admin Hub Backend (`adminhub_back`)  
**Deployment Target**: Railway Production Service

This document defines every environment variable consumed by the Miles Admin Hub API, its source, required format, and whether it must be treated as a sensitive secret in Railway's Environment Variables dashboard.

---

## Environment Variables Matrix

### 1. `NODE_ENV`
* **Purpose**: Declares the Node.js runtime execution environment. Controls production optimizations, disables stack trace exposure in API error filters, and disables default development Swagger mounting.
* **Required/Optional**: REQUIRED
* **Railway Value / Source**: `production`
* **Example Format**: `production`
* **Secret**: NO

---

### 2. `PORT`
* **Purpose**: The TCP port on which the NestJS HTTP application listens for incoming traffic.
* **Required/Optional**: REQUIRED (Automatically injected by Railway runtime)
* **Railway Value / Source**: Provided dynamically by Railway container environment (`${{PORT}}`)
* **Example Format**: `4000` (or Railway-assigned port such as `8080`)
* **Secret**: NO

---

### 3. `HOST`
* **Purpose**: The network interface binding for the HTTP server. Must bind to `0.0.0.0` in Docker containers to accept forwarded reverse-proxy requests from Railway edge routers.
* **Required/Optional**: OPTIONAL (Defaults to `0.0.0.0`)
* **Railway Value / Source**: `0.0.0.0`
* **Example Format**: `0.0.0.0`
* **Secret**: NO

---

### 4. `DATABASE_URL`
* **Purpose**: Primary PostgreSQL connection string used by Prisma ORM for running database migrations and querying application data.
* **Required/Optional**: REQUIRED
* **Railway Value / Source**: `${{Postgres.DATABASE_URL}}` (Reference the Railway PostgreSQL service directly, or paste connection string if using external PostgreSQL)
* **Example Format**: `postgresql://postgres:password123@postgres.railway.internal:5432/railway?schema=public`
* **Secret**: YES

---

### 5. `JWT_SECRET`
* **Purpose**: High-entropy cryptographic symmetric key used by NestJS Passport JWT module to sign and verify JSON Web Tokens issued during admin login.
* **Required/Optional**: REQUIRED (Must be minimum 16 characters; 64-byte hex string recommended)
* **Railway Value / Source**: Generate manually using CLI:  
  `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
* **Example Format**: `82d231d4c3e42bbe86857c701b649d3f6cdf811e14c2115c7437baf9b7280d2281b8f141be5ce41c78bd6b928737a98379909956148bd2d5dd3d1c196ef17bb1`
* **Secret**: YES

---

### 6. `JWT_EXPIRES_IN`
* **Purpose**: Lifespan duration of issued JSON Web Tokens before requiring re-authentication.
* **Required/Optional**: OPTIONAL (Defaults to `1d`)
* **Railway Value / Source**: `1d`
* **Example Format**: `1d`, `12h`, or `7d`
* **Secret**: NO

---

### 7. `CORS_ORIGIN`
* **Purpose**: Allowed browser origin(s) permitted to execute cross-origin requests to this backend. Supports comma-separated list of origins. Wildcards (`*`) must NEVER be used in production.
* **Required/Optional**: REQUIRED
* **Railway Value / Source**: Production frontend URL (e.g. `https://miles-flax.vercel.app`)
* **Example Format**: `https://miles-flax.vercel.app`
* **Secret**: NO

---

### 8. `FRONTEND_URL`
* **Purpose**: Alternative origin configuration alias for `CORS_ORIGIN`. Kept for full backwards-compatibility with existing code and tests. If omitted, automatically defaults to `CORS_ORIGIN`.
* **Required/Optional**: OPTIONAL (Satisfied by `CORS_ORIGIN`)
* **Railway Value / Source**: `https://miles-flax.vercel.app`
* **Example Format**: `https://miles-flax.vercel.app`
* **Secret**: NO

---

### 9. `THROTTLE_TTL`
* **Purpose**: Rate limiting window in seconds for the global ThrottlerGuard.
* **Required/Optional**: REQUIRED (Validated by Joi schema)
* **Railway Value / Source**: `60`
* **Example Format**: `60`
* **Secret**: NO

---

### 10. `THROTTLE_LIMIT`
* **Purpose**: Maximum number of HTTP requests allowed per IP address within the `THROTTLE_TTL` window.
* **Required/Optional**: REQUIRED (Validated by Joi schema)
* **Railway Value / Source**: `100`
* **Example Format**: `100`
* **Secret**: NO

---

### 11. `LOGIN_THROTTLE_LIMIT`
* **Purpose**: Stricter rate limit applied specifically to the `/api/v1/auth/login` endpoint to prevent brute-force credential stuffing attacks.
* **Required/Optional**: REQUIRED (Validated by Joi schema)
* **Railway Value / Source**: `5`
* **Example Format**: `5`
* **Secret**: NO

---

### 12. `SWAGGER_ENABLED`
* **Purpose**: Controls whether Swagger / OpenAPI documentation is generated and mounted at `/api/docs`. In production, this should be set to `false` to avoid exposing API surface metadata publicly, or `true` if public documentation is explicitly desired.
* **Required/Optional**: OPTIONAL (Defaults to `false` when `NODE_ENV=production`)
* **Railway Value / Source**: `false`
* **Example Format**: `false` (or `true`)
* **Secret**: NO

---

### 13. `RUN_MIGRATIONS`
* **Purpose**: Controls whether `scripts/docker-entrypoint.sh` executes `npx prisma migrate deploy` upon container startup. If Railway Pre-Deploy Command is configured with `npx prisma migrate deploy`, this can be kept as `true` (idempotent) or set to `false`.
* **Required/Optional**: OPTIONAL (Defaults to `true`)
* **Railway Value / Source**: `true`
* **Example Format**: `true`
* **Secret**: NO

---

## Summary of Railway Variables Checklist

| Variable Name | Required | Default | Sensitive Secret? |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **YES** | `development` | NO |
| `PORT` | **YES** | Auto (`${{PORT}}`) | NO |
| `HOST` | NO | `0.0.0.0` | NO |
| `DATABASE_URL` | **YES** | None (`${{Postgres.DATABASE_URL}}`) | **YES** |
| `JWT_SECRET` | **YES** | None (Min 16 chars) | **YES** |
| `JWT_EXPIRES_IN` | NO | `1d` | NO |
| `CORS_ORIGIN` | **YES** | None | NO |
| `FRONTEND_URL` | NO | Defaults to `CORS_ORIGIN` | NO |
| `THROTTLE_TTL` | **YES** | `60` | NO |
| `THROTTLE_LIMIT` | **YES** | `100` | NO |
| `LOGIN_THROTTLE_LIMIT` | **YES** | `5` | NO |
| `SWAGGER_ENABLED` | NO | `false` in production | NO |
| `RUN_MIGRATIONS` | NO | `true` | NO |
