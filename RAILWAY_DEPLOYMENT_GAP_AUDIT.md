# Railway Backend Deployment Gap Audit

**Date**: 2026-10-06  
**Project**: Miles Admin Hub Backend (`adminhub_back`)  
**Target Platform**: Railway (Containerized Docker Architecture + Railway Managed PostgreSQL)

---

## 1. Executive Summary

This deployment gap audit comprehensively analyzes all 28 project operational facets required for seamless, production-grade deployment of the AdminHub Backend on Railway. Every area is audited against the actual source code, Prisma schema, Docker configuration, and NestJS runtime pipelines.

---

## 2. Comprehensive Gap Audit Table

| AREA | CURRENT STATE | GAP | ACTION | STATUS |
| :--- | :--- | :--- | :--- | :--- |
| **package.json** | Node scripts configured (`build`, `start:prod`, `test`, `test:e2e`, `lint`, `prisma:deploy`). Dependencies include NestJS v12, Prisma Client v6.4.1. | `start:prod` previously invoked `node dist/main` without explicit ESM `.js` extension; `prisma` CLI was previously in `devDependencies` only and risked removal on `npm prune --omit=dev`; Node engines unpinned. | Updated `start:prod` to `node dist/main.js`, moved `prisma` to `dependencies` for runtime migration execution, added `engines.node >=22.0.0`. | FIXED |
| **package-lock.json** | Generated lockfile version 3. Zero references to outdated TypeScript versions. | Must synchronize with `prisma` in `dependencies` and dev dependencies. | Ran clean `npm install` and verified deterministic `npm ci --dry-run` success. | VERIFIED |
| **nest-cli.json** | Standard NestJS 12 CLI configuration with `deleteOutDir: true` and `sourceRoot: src`. | None. CLI builds application output directly to `./dist`. | Preserved without modifications. | IMPLEMENTED |
| **tsconfig.json / tsconfig.build.json** | NodeNext module resolution, ES2023 target, decorator support. `tsconfig.build.json` extends base and targets `src`. | `Dockerfile` previously failed to copy `tsconfig.build.json` in Stage 3, causing build to compile untyped seed/spec files. | Added `COPY tsconfig.json tsconfig.build.json nest-cli.json ./` to Dockerfile; excluded `prisma` and `**/*spec.ts` in `tsconfig.build.json`. | FIXED |
| **Prisma Schema** | PostgreSQL datasource using `env("DATABASE_URL")`. Models: Admin, User, Transaction, Booking, Alert, ActivityLog, WorkspaceSettings. Atomic sequences declared. | None. Schema is complete and fully production-hardened with Decimal precision for financial fields. | Retained existing schema without modifications. | IMPLEMENTED |
| **Prisma Migrations** | 2 SQL migrations exist in `prisma/migrations/`: `20261005162303_init_adminhub_schema` and `20261006090358_add_workspace_settings`. | None. Production must strictly use `npx prisma migrate deploy` and never `db push` or `migrate dev`. | Verified `prisma migrate status` confirms 0 pending migrations and database schema up to date. | VERIFIED |
| **Prisma Seed Configuration** | Seed script exists in `prisma/seed.ts` configured in `package.json` under `prisma.seed`. | Production environments must NEVER run demo/synthetic data seeding automatically. | Configured seed policy: `MIGRATIONS=YES, SEED=NO`. Seed is excluded from Docker build and runtime entrypoint. | FIXED |
| **src/main.ts** | NestFactory bootstraps AppModule, enables shutdown hooks, attaches Helmet, validates requests, binds port & host. | Port previously bound to default without validating 0.0.0.0 explicit listen; CORS needed support for both `CORS_ORIGIN` and `FRONTEND_URL`. | Hardened `app.listen(port, host)` with host default `0.0.0.0`; support comma-separated origins. | FIXED |
| **Configuration Module** | `@nestjs/config` loads environment variables into strongly-typed `AppConfig` object with fallbacks. | `frontendUrl` mapped solely to `FRONTEND_URL` rather than checking `CORS_ORIGIN`. | Updated `configuration.ts` to read `process.env.CORS_ORIGIN || process.env.FRONTEND_URL`. | FIXED |
| **Environment Validation** | Strict Joi schema validates all required environment variables on startup. | Missing `CORS_ORIGIN` alias support in Joi schema; `FRONTEND_URL` failed when only `CORS_ORIGIN` provided. | Updated `validation.ts` to allow `CORS_ORIGIN` and default `FRONTEND_URL` to `CORS_ORIGIN` when provided. | FIXED |
| **Authentication & RBAC** | JWT authentication via Passport JWT strategy, bcrypt password hashing, `RolesGuard` enforcing `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `VIEWER`. | None. Password hashes stripped from responses; full test coverage across all roles. | Verified all unit and E2E authentication tests pass without regression. | IMPLEMENTED |
| **JWT Configuration** | `JWT_SECRET` minimum 16 chars (32+ recommended), `JWT_EXPIRES_IN` default `1d`. | None. Secret is strictly environment-driven. | Confirmed zero hardcoded secrets exist in tracked files. | IMPLEMENTED |
| **CORS Configuration** | Origin whitelist dynamically parsed from comma-separated origins, credentials allowed, wildcard denied in production. | Railway conventionally defines `CORS_ORIGIN=https://miles-flax.vercel.app`. | Supported both `CORS_ORIGIN` and `FRONTEND_URL` with multi-origin parsing. | FIXED |
| **Swagger / OpenAPI** | Mounted at `/api/docs` with bearer auth definition and categorized tag structure. | Swagger should be disabled by default in production unless explicitly enabled via environment variable. | Confirmed `swagger.enabled` defaults to `false` when `NODE_ENV=production`, overridable by `SWAGGER_ENABLED=true`. | IMPLEMENTED |
| **Health Endpoints** | `GET /health` and `GET /api/v1/health` return process uptime and ISO timestamp. Excluded from global prefix rewrite. | Railway healthcheck requires a root `/health` path returning HTTP 200. | Verified `GET /health` and `GET /api/v1/health` return HTTP 200 independently of database status. | VERIFIED |
| **Readiness Probes** | `GET /health/ready` and `GET /api/v1/health/ready` execute `SELECT 1` against PostgreSQL via Prisma. | Database failure must return HTTP 503 while keeping process liveness at `/health` alive. | Verified `getReadiness()` throws `ServiceUnavailableException` (503) on DB disconnect while `/health` returns 200. | VERIFIED |
| **Dockerfile** | Multi-stage build (`node:22-alpine`), non-root `node` user, `dumb-init`, OpenSSL for Prisma. | Stage 3 omitted `tsconfig.build.json`; HEALTHCHECK used hardcoded port 4000 instead of dynamic Railway `$PORT`. | Added `tsconfig.build.json` to Stage 3 COPY; updated HEALTHCHECK to `http://localhost:${PORT:-4000}/health`. | FIXED |
| **docker-compose.yml** | Local multi-container development environment with PostgreSQL 16 and backend API. | None. Used for local container testing. | Preserved. Railway uses standalone root `Dockerfile`. | IMPLEMENTED |
| **.dockerignore** | Ignores `node_modules`, `dist`, `.git`, `.env*`, coverage, tests. | None. Preserves `prisma/schema.prisma` and `prisma/migrations` for runtime migrations. | Verified migrations and schema are included in Docker context. | IMPLEMENTED |
| **.gitignore** | Ignores `.env`, `.env.*`, `dist`, `node_modules`, `coverage`, build info. | None. No environment or credential files are tracked by Git. | Verified clean working tree and tracked files. | VERIFIED |
| **Deployment Scripts** | `scripts/docker-entrypoint.sh` executes migrations upon container start; `scripts/run-migrations.cjs` for standalone deploy. | `docker-entrypoint.sh` was not marked executable in git tree index (100644). | Updated git index mode to `100755` (`chmod +x`). | FIXED |
| **Test Configuration** | Vitest 4 with unit configuration and E2E configuration (`vitest.config.ts`, `vitest.config.e2e.ts`). | E2E tests previously imported `supertest/types` which caused TypeScript errors under nodenext resolution. | Refactored E2E test files to use native `INestApplication` typing; 100% tests pass. | FIXED |
| **E2E Configuration** | 11 E2E suites covering Auth, Users, Transactions, Bookings, Dashboard, Alerts, Admins, Activities, Settings, App, Workflows. | None. 177 tests run against in-memory/test modules with clean isolation. | Verified 177 / 177 tests pass. | VERIFIED |
| **Logging & Security** | NestJS Logger with structured messages. Sensitive fields (`passwordHash`) scrubbed; stack traces suppressed in production filters. | None. Global exception filter redacts stack traces in production. | Retained existing production exception filter. | IMPLEMENTED |
| **Graceful Shutdown** | `app.enableShutdownHooks()` in `main.ts`; `PrismaService.onModuleDestroy()` calls `$disconnect()`. `dumb-init` in container. | None. Container safely forwards SIGTERM/SIGINT to Node.js process. | Verified shutdown hook configuration. | IMPLEMENTED |
| **Database Connection** | Uses `DATABASE_URL` PostgreSQL connection string with schema search path. | None. Railway managed Postgres directly populates `${{Postgres.DATABASE_URL}}`. | Verified compatibility with standard Railway database connection string. | IMPLEMENTED |
| **Redis / Queue / Workers** | Evaluated whether backend requires Redis or background queue infrastructure. | Backend does not implement Redis, BullMQ, Kafka, or worker processes. | Do NOT deploy Redis or background workers. Standalone NestJS instance is sufficient. | NOT REQUIRED |
| **Host & Port Binding** | Express server listens on host `0.0.0.0` and dynamic port provided by `process.env.PORT`. | Hardcoded host or port would break Railway reverse proxy routing. | Verified `PORT` and `HOST` read dynamically from `ConfigService`. | VERIFIED |

---

## 3. Status Definition Summary

* **IMPLEMENTED**: Fully built, configured, and operational in codebase.
* **VERIFIED**: Empirically tested and confirmed working via automated suites or runtime commands.
* **FIXED**: Gap identified and resolved during this deployment preparation phase.
* **NOT REQUIRED**: Explicitly evaluated and omitted because the backend architecture does not use it (e.g., Redis, Kafka, BullMQ).
* **BLOCKED**: None.
* **DEFERRED**: None.
