# Backend Architecture Proposal

> **Pattern:** Modular Monolith (NestJS 10+ / Express / TypeScript Strict Mode)  
> **ORM:** Prisma ORM with PostgreSQL  
> **Documentation:** Swagger / OpenAPI mounted at `/api/docs`

---

## 1. Directory Structure Layout

The backend follows a feature-oriented modular architecture. All business domains are isolated into dedicated modules with thin controllers, rich services, typed DTOs, and shared utilities in `common/`.

```text
src/
├── config/                      # Environment configuration & Joi schema validation
│   ├── configuration.ts         # Typed config factory
│   └── validation.ts            # Joi startup validator
│
├── prisma/                      # Database client lifecycle module
│   ├── prisma.service.ts        # PrismaClient wrapper with clean connect/disconnect hooks
│   └── prisma.module.ts         # Global Prisma provider export
│
├── common/                      # Shared cross-cutting concerns & reusable helpers
│   ├── decorators/
│   │   ├── current-user.decorator.ts  # Extracts authenticated admin from request
│   │   ├── public.decorator.ts        # Bypasses global JWT guard
│   │   └── roles.decorator.ts         # Declares required admin roles
│   ├── dto/
│   │   ├── pagination-query.dto.ts    # Standard page, limit query validator
│   │   └── paginated-response.dto.ts  # Standard { data, meta } envelope type
│   ├── filters/
│   │   └── all-exceptions.filter.ts   # Normalized error filter { statusCode, message, ... }
│   ├── guards/
│   │   ├── jwt-auth.guard.ts          # Global guard respecting @Public()
│   │   └── roles.guard.ts             # Role-based access control guard
│   └── helpers/
│       ├── pagination.helper.ts       # Page/limit math & envelope builder
│       ├── date-range.helper.ts       # Calendar month & rolling period calculations
│       └── money.helper.ts            # Decimal to 2-decimal float serializer
│
├── auth/                        # Admin authentication module
│   ├── dto/
│   │   └── login.dto.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts            # Passport JWT validation strategy
│   ├── auth.controller.ts       # POST /auth/login, GET /auth/me
│   ├── auth.service.ts          # Password verification (bcrypt), JWT generation
│   └── auth.module.ts
│
├── dashboard/                   # Aggregation & metrics module
│   ├── dto/
│   │   └── charts-query.dto.ts
│   ├── dashboard.controller.ts  # Stats, charts, alerts, health, recent-transactions
│   ├── dashboard.service.ts     # SQL aggregations, MoM deltas, time-series bucketing
│   └── dashboard.module.ts
│
├── users/                       # Customer directory module
│   ├── dto/
│   │   ├── users-query.dto.ts
│   │   ├── create-user.dto.ts
│   │   └── update-user.dto.ts
│   ├── users.controller.ts      # CRUD, search, filter, stats, soft-delete
│   ├── users.service.ts         # User lifecycle, userCode generation, soft deletion
│   └── users.module.ts
│
├── transactions/                # Financial ledger module
│   ├── dto/
│   │   ├── transactions-query.dto.ts
│   │   ├── create-transaction.dto.ts
│   │   └── update-transaction-status.dto.ts
│   ├── transactions.controller.ts
│   ├── transactions.service.ts  # Invoices, ledger queries, status history logs
│   └── transactions.module.ts
│
├── bookings/                    # Service appointments module
│   ├── dto/
│   │   ├── bookings-query.dto.ts
│   │   ├── create-booking.dto.ts
│   │   └── update-booking.dto.ts
│   ├── bookings.controller.ts
│   ├── bookings.service.ts      # Logistics, reschedule, cancel, lifecycle logs
│   └── bookings.module.ts
│
├── health/                      # Heartbeat / health check module
│   ├── health.controller.ts     # GET /health, GET /api/v1/health
│   └── health.module.ts
│
├── app.module.ts                # Root application module wiring all features
└── main.ts                      # App bootstrap, prefixing, global pipes, filters, Swagger
```

---

## 2. Layer Responsibilities & Module Boundaries

### 2.1. Module Boundaries
- Each feature domain (`auth`, `dashboard`, `users`, `transactions`, `bookings`, `health`) is fully self-contained in its module folder.
- Inter-module dependencies are resolved strictly by importing the required module into the feature's `@Module({ imports: [...] })`.
- Shared entities and Prisma database access are provided globally via `PrismaModule`.

### 2.2. Controller Responsibility (Thin Layer)
- Route definition, HTTP verbs, and path parameter mapping.
- Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`) for 100% documentation coverage.
- Automatic request binding via DTOs and parameter decorators (`@Body()`, `@Query()`, `@Param()`).
- **Strict Rule:** Controllers contain **zero** SQL queries, zero calculations, zero business rules, and zero branching logic.

### 2.3. Service Responsibility (Business Logic Layer)
- All domain rules, validation logic, calculations, and data workflows.
- Execution of database queries and transactions via Prisma ORM.
- Month-over-Month (MoM) percentage calculations and rolling time-window bucketing.
- Auditing timeline generation: automatically writing to `TransactionStatusHistory`, `BookingLog`, and `ActivityLog`.
- Data transformation from database models to public response shapes (combining names, serializing decimals).

### 2.4. DTO Responsibility (Input Validation & Typing)
- Input contract definition with strict TypeScript types.
- Runtime data validation using `class-validator` (`@IsString()`, `@IsEmail()`, `@IsEnum()`, `@IsOptional()`, `@IsNumber()`, `@Min()`, `@Max()`).
- Data sanitization and coercion using `class-transformer` (`@Type(() => Number)`, `@Transform(...)`).
- Swagger API properties (`@ApiProperty()`, `@ApiPropertyOptional()`).

### 2.5. Prisma Responsibility (Data Persistence)
- Type-safe database queries.
- Migrations engine maintaining versioned DDL history in `prisma/migrations`.
- Relation management, cascading deletes, foreign key verification.
- Connection pooling and lifecycle management via `PrismaService` hooks.

---

## 3. Cross-Cutting Engineering Systems

### 3.1. Authentication & Security Flow
1. **Public vs Protected:** A global `JwtAuthGuard` is registered on the entire application (`APP_GUARD`). Endpoints decorated with `@Public()` (such as `POST /auth/login` and `GET /health`) bypass token verification.
2. **Passport Strategy:** `JwtStrategy` extracts the Bearer token from the `Authorization` header, validates its signature and expiration using `JWT_SECRET`, and extracts the payload `{ sub, email, role }`.
3. **Current User Decorator:** `@CurrentUser()` retrieves the authenticated administrator from `request.user`.
4. **Rate Limiting:** Stricter throttler guard applied to `/auth/login` (5 req/min) prevents brute-force attempts; general throttler (100 req/min) protects all other endpoints.
5. **Security Headers:** `helmet()` initialized in `main.ts` sets standard HTTP security headers (CSP, HSTS, X-Frame-Options).

### 3.2. Error Handling & Exception Filter
A single centralized `AllExceptionsFilter` (`APP_FILTER`) intercepts all exceptions:
- **HttpException:** Extracts status code and validation error arrays.
- **Prisma Client Known Request Errors:**
  - `P2002` (Unique constraint violation) → Translates to `409 Conflict` with the conflicting field name.
  - `P2025` (Record not found) → Translates to `404 Not Found`.
  - `P2003` (Foreign key violation) → Translates to `400 Bad Request`.
- **Unhandled Internal Errors:** Logs full error stack internally via NestJS `Logger`, returns sanitized `500 Internal Server Error` with **zero stack trace leakage**.
- **Output Format:** Guarantees uniform payload `{ statusCode, message, error, timestamp, path }`.

### 3.3. Request Validation Pipeline
A global `ValidationPipe` is registered with:
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // Strips properties not defined in the DTO
    transform: true,            // Automatically transforms payloads to DTO instances
    forbidNonWhitelisted: true, // Rejects unexpected fields with 400 Bad Request
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

### 3.4. Pagination Strategy
All list endpoints (`/users`, `/transactions`, `/bookings`) inherit from `PaginationQueryDto`:
- `page`: default `1`, minimum `1`.
- `limit`: default `10`, minimum `1`, maximum `100`.
- Service computes `skip = (page - 1) * limit` and `take = limit`.
- Standard envelope helper returns:
  ```json
  {
    "data": [ ... ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1420,
      "totalPages": 142
    }
  }
  ```

### 3.5. Monetary Decimal Precision Strategy
- Database stores amounts as PostgreSQL `DECIMAL(12, 2)`.
- Services use a dedicated conversion helper `formatMoney(val: Decimal | number): number` to output clean 2-decimal floats (`Number(Number(val).toFixed(2))`).
- Prevents raw Prisma Decimal object leakage and JavaScript floating-point noise.
