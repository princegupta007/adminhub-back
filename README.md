# Miles Admin Hub API

> **Production-Ready REST API for Miles Admin Dashboard**  
> Built with NestJS 10+ (strict TypeScript), PostgreSQL, Prisma ORM, and Passport JWT Authentication.

---

## 1. Tech Stack

- **Framework:** NestJS 10+ (TypeScript Strict Mode, ESM NodeNext)
- **Database & ORM:** PostgreSQL + Prisma ORM 6 (strictly version-controlled migrations)
- **Authentication:** JWT via `passport-jwt` + bcrypt (10 salt rounds)
- **Validation:** `class-validator` + `class-transformer` (global whitelist & forbidden unknown properties)
- **Security:** Helmet headers, CORS restricted to configured origins, rate limiting via `@nestjs/throttler`
- **Documentation:** Interactive Swagger/OpenAPI mounted at `/api/docs`
- **Testing:** Vitest + Supertest

---

## 2. Getting Started

### Prerequisites
- Node.js 20+ / 24+
- PostgreSQL 14+ instance running locally or via Docker

### Environment Setup
Copy the example environment file and configure local credentials:
```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | HTTP server port | `4000` |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/miles_admin_dev?schema=public` |
| `JWT_SECRET` | Secret key for signing JWT tokens (min 32 chars) | Safe random string |
| `JWT_EXPIRES_IN` | Token time-to-live string | `1d` |
| `FRONTEND_URL` | Allowed frontend origin list (comma-separated) | `http://localhost:3000,https://miles-flax.vercel.app` |
| `THROTTLE_TTL` | Throttler window duration in seconds | `60` |
| `THROTTLE_LIMIT` | Global requests allowed per window | `100` |
| `LOGIN_THROTTLE_LIMIT`| Stricter requests allowed on `/api/v1/auth/login` | `5` |

---

## 3. Database Migration & Seeding

1. **Run Prisma Migrations:**
   ```bash
   npm run prisma:migrate
   ```
2. **Seed Initial Database Data:**
   ```bash
   npm run prisma:seed
   ```

### Seeded Super Admin Credentials
- **Email:** `admin@miles.io`
- **Password:** `Admin@123`
- **Role:** `SUPER_ADMIN`
- **Seeded Dataset:** 50 users, 120 historical transactions with child history logs, 60 bookings with audit logs, 45 activity logs, 3 dashboard alerts.

---

## 4. Running the Application

```bash
# Development mode with hot-reload
npm run start:dev

# Production build & start
npm run build
npm run start:prod
```

### Key Endpoints
- **Swagger Documentation:** `http://localhost:4000/api/docs`
- **Public Health Probe:** `http://localhost:4000/health` or `http://localhost:4000/api/v1/health`
- **Admin Login:** `POST http://localhost:4000/api/v1/auth/login`
- **Admin Profile:** `GET http://localhost:4000/api/v1/auth/me`

---

## 5. Authentication & JWT Usage

### Login Request
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@miles.io","password":"Admin@123"}'
```

**Response (`200 OK`):**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": "b3f5818f-afb9-4ffb-a626-e1ce3548f7d7",
      "name": "Sarah Jenkins",
      "email": "admin@miles.io",
      "role": "SUPER_ADMIN",
      "avatarUrl": "https://i.pravatar.cc/150?u=admin_sarah",
      "twoFactorEnabled": true
    }
  }
}
```

### Authenticated Requests
Pass the access token in the `Authorization` header:
```bash
curl -X GET http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

---

## 6. Testing & Quality Verification

```bash
# Run unit tests
npm test

# Run end-to-end integration tests
npm run test:e2e

# Run linter
npm run lint

# Format codebase
npm run format

# TypeScript strict build
npm run build
```

---

## 7. Enterprise Workflows & Bulk Operations (Phase 11)

- **Bulk User Management:**
  - `POST /api/v1/users/bulk/status`: Batch status transitions (`ACTIVE`, `INACTIVE`, `SUSPENDED`) with transactional audit records.
  - `POST /api/v1/users/bulk/role`: Batch role transitions (`ADMIN`, `EDITOR`, `VIEWER`) guarded by `SUPER_ADMIN` RBAC.
  - `POST /api/v1/users/bulk/delete`: Batch soft-deletion with user code preservation.
- **RFC 4180 CSV Exports:**
  - `GET /api/v1/users/export`: Raw CSV stream with Excel-friendly UTF-8 BOM and formula injection protection.
  - `GET /api/v1/transactions/export`: Filtered transaction ledger export.
  - `GET /api/v1/bookings/export`: Filtered appointments and scheduling export.
  - `GET /api/v1/dashboard/reports/export`: 12-month analytics and summary totals export.
- **Direct Entity Lifecycles:**
  - `POST /api/v1/transactions/:id/refund`: Automated refund processing with audit timeline log.
  - `POST /api/v1/bookings/:id/reschedule`: Future appointment rescheduling with overlapping collision prevention.
  - `POST /api/v1/bookings/:id/cancel`: Appointment cancellation with reason logging.
- **Cross-Entity Omni-Search:**
  - `GET /api/v1/search?q=:query`: Unified search across Users, Transactions, and Bookings for command palettes and global search bars.

