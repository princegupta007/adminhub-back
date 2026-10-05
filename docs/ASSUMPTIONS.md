# Assumptions, Inferences & Ambiguities Matrix

> **Purpose:** Explicitly document confirmed facts vs inferences, technical decisions, and open ambiguities. No assumptions are converted silently into requirements.

---

## Category A: Confirmed Requirements

These requirements are directly documented and mandated by the assignment evaluation brief and/or explicit Figma specifications.

1. **Stack & Framework:**
   - NestJS 10+ with TypeScript in strict mode (no `any` unless strictly unavoidable).
   - PostgreSQL database managed exclusively via Prisma ORM migrations (`prisma migrate dev` / `prisma migrate deploy`). Never `db push` in place of migrations, never raw unmanaged SQL DDL.
   - Global validation pipe using `class-validator` and `class-transformer` with `whitelist: true`, `transform: true`, `forbidNonWhitelisted: true`.
   - Security: Helmet headers, rate limiting via `@nestjs/throttler` (global standard, stricter limit on `/auth/login`), CORS restricted to environment-configured whitelist.
   - Swagger / OpenAPI mounted at `/api/docs` documenting 100% of endpoints.
   - Environment variables loaded via `@nestjs/config` and validated at startup with Joi.

2. **Domain Entities & Seeding:**
   - `Admin` entity with seeded account: `admin@miles.io` / `Admin@123` (hashed with bcrypt, 10 rounds).
   - `User` entity representing dashboard customer directory, with soft delete capability (`deletedAt`).
   - `Transaction` entity with signed Decimal amount (refunds negative), currency `"USD"`, gateway fee, subtotal, total, and related `TransactionStatusHistory` timeline.
   - `Booking` entity with `scheduledAt`, `durationHours`, derived `endTime`, meeting location, pricing, payment status, and related `BookingLog` timeline.
   - `ActivityLog` entity for user security and profile update logs.
   - `Alert` entity powering dashboard system alerts.

3. **Core API Surface & Response Envelopes:**
   - Global route prefix `/api/v1` for all feature endpoints.
   - Global JWT guard active on all routes except `POST /api/v1/auth/login` and `GET /health`.
   - List endpoints return `{ data: [...], meta: { page, limit, total, totalPages } }`. Default `page=1`, default `limit=10`, max `limit=100`. Empty lists return HTTP 200 with `data: []` and `meta.total: 0`.
   - Single-resource endpoints return the resource object directly without an outer data envelope.
   - Global exception filter formatting all errors into `{ statusCode, message, error, timestamp, path }`.
   - All monetary values formatted as JSON numbers with 2 decimal places. All dates formatted as ISO 8601 strings.
   - MoM percentage changes calculated server-side comparing current calendar month to the previous calendar month.

---

## Category B: Strong Inferences

These elements are derived from direct inspection of the existing Next.js frontend code in `E:\projects\adminhub` and standard industry dashboard practices.

1. **Lookup by Code vs UUID (`:code` routes):**
   - *Inference:* Endpoints `GET /users/:code`, `GET /transactions/:code`, and `GET /bookings/:code` accept either human-readable codes (`USR-0001`, `TXN-0017`, `BKG-0045`) or UUIDs.
   - *Evidence:* The frontend URLs route using IDs (e.g. `/users/1`, `/transactions/1082`, `/bookings/1001`), whereas display cards render `#USR-0001`, `#TXN-1082`, `#BKG-1001`. Supporting both ensures seamless interoperability.

2. **Transaction Status Mapping (`paid` vs `COMPLETED`):**
   - *Inference:* The frontend displays `"paid"`, `"pending"`, `"failed"`, `"refunded"`. The backend domain model specifies `COMPLETED`, `PENDING`, `FAILED`, `REFUNDED`.
   - *Evidence:* In `src/features/transactions/types.ts` and `derive.ts`, `deriveTransactionStatus` assigns `"paid"` to successful payments. Mapping `COMPLETED` to `"paid"` in frontend-facing responses (or accepting `COMPLETED` as the enum representation) provides 100% semantic parity.

3. **User Full Name Representation:**
   - *Inference:* The database stores `firstName` and `lastName` separately, while the API exposes a computed `name` field (`${firstName} ${lastName}`) alongside individual name fields.
   - *Evidence:* Assignment explicitly states: *"User ... firstName, lastName (expose combined "name" in responses)"*.

4. **Service Catalogue & Pricing Bands:**
   - *Inference:* Bookings belong to categories defined in `src/lib/derive.ts` (`Cleaning`, `Plumbing`, `Appliances`, `Electrical`, `Painting`, `Carpentry`, `Pest Control`, `Gardening`, `Beauty`, `Wellness`, `Design`, `Moving`), with realistic prices in the $39.00 – $249.00 range.
   - *Evidence:* `BOOKING_SERVICES` in frontend `derive.ts` lines 86–107.

5. **2FA Status Default:**
   - *Inference:* Admin accounts have `twoFactorEnabled = true` by default (as seen in `ProfileView`), whereas regular app users default to `twoFactorEnabled = false` unless enabled.
   - *Evidence:* `src/features/profile/components/profile-view.tsx` displays "Two-factor auth: Enabled".

---

## Category C: Unresolved Ambiguities

These areas represent design choices where the frontend mock and assignment specification allow multiple interpretations.

1. **User Identifier Format on Create:**
   - *Ambiguity:* Should `userCode` (`USR-0001`, `USR-0002`) be auto-generated by the database/service via a sequential counter, or supplied in the request body?
   - *Resolution:* Auto-generate sequentially via service transaction (`USR-` + zero-padded increment) during `POST /users`, ensuring client callers cannot create collisions or disrupt the format.

2. **Bulk Actions on Users Directory:**
   - *Ambiguity:* The frontend `users-desktop-view.tsx` includes a bulk action toolbar when rows are checked ("Change Role", "Suspend Accounts") but only triggers a "Coming Soon" dialog.
   - *Resolution:* Support individual `PATCH /users/:code` endpoints first. If bulk updates are needed, they can be processed via individual PATCH calls or an optional bulk endpoint.

3. **Search Query Parameter Naming:**
   - *Ambiguity:* The frontend uses `q` in some places (`searchParams.get("q")`) and `search` in others (`useUsersTable({ search })`).
   - *Resolution:* DTOs will accept either `q` or `search` using a class-transformer alias/fallback decorator so both frontend conventions succeed.

4. **Health Endpoint Global Prefix:**
   - *Ambiguity:* Should `GET /health` be at the root `/health` or prefixed `/api/v1/health`?
   - *Resolution:* Both `/health` and `/api/v1/health` are mapped and exclude the JWT auth guard.

---

## Category D: Technical Decisions

These architectural and engineering decisions have been selected to ensure code quality, safety, and maintainability.

1. **Prisma Decimal vs JavaScript Numbers:**
   - *Decision:* Prisma returns `Prisma.Decimal` instances for decimal columns. In DTO serializers and service transforms, all amounts are serialized to standard JavaScript floats with two decimals (`Number(val.toFixed(2))`) before transmission.
   - *Rationale:* JavaScript JSON does not have a native Decimal type. Sending raw Decimal objects yields strings or objects, while unrounded floats create floating-point noise (e.g. `120.0000000001`).

2. **Soft Delete Query Filter via Middleware / Extension:**
   - *Decision:* Queries for `User` explicitly filter `{ deletedAt: null }` in the service repositories, and unique indexes on `email` and `userCode` are handled cleanly.
   - *Rationale:* Ensures soft-deleted users are invisible in normal operations while preserving historical data for foreign key joins in financial transactions.

3. **MoM Calculation Calendar vs Rolling 30 Days:**
   - *Decision:* Calculate MoM based on current calendar month (e.g., Oct 1 to Oct 5) vs prior calendar month (Sep 1 to Sep 30), exactly as requested by assignment rule *"Percent changes on stats are computed server-side vs the previous calendar month"*.
   - *Rationale:* Conforms strictly to the assignment evaluation rubric.

4. **Seeding Strategy for Realistic Historical Data:**
   - *Decision:* The database seeder will generate realistic historical records spanning 12 calendar months so that charts (`7d`, `1m`, `3m`, `6m`, `1y`) and MoM stats show meaningful, realistic curves without flat lines.
   - *Rationale:* Evaluators testing chart endpoints with different ranges will receive valid data points across every month.
