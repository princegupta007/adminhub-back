# Bookings Module Specification & Documentation

## 1. Overview
The **Bookings Module** (`src/bookings`) provides full lifecycle management, temporal scheduling, conflict-safe concurrency, search/filtering, and financial tracking for customer service bookings in the Miles Admin Hub platform.

It is designed to strictly align with:
- **Figma Designs & Specifications**: Matches the Admin Dashboard Bookings view, customer appointment history, and booking detail drawers.
- **Frontend Architecture**: Integrates with the deployed Next.js/React frontend (`miles-flax.vercel.app`), matching query parameters, filter structures, statistics cards, and detail view schemas.
- **Data Integrity & Concurrency**: Enforces non-overlapping time windows for active bookings per customer, atomic sequence allocation for business codes, and decimal-accurate financial processing.

---

## 2. Architecture & Design Principles

```
  HTTP Request (Bearer JWT)
             │
             ▼
   BookingsController (`/api/v1/bookings`)
             │
             ├── ValidationPipe & DTOs (ParseUUID, Regex, Query Transforms)
             │
             ▼
   BookingsService
             │
             ├── Overlap Detection (`checkTimeCollision`)
             ├── Sequence Generation (`BKG-XXXX`, `INV-XXXX`)
             ├── Time Invariant Enforcement (`endTime = scheduledAt + durationHours * 3600 * 1000`)
             ├── Atomic DB Transactions (`prisma.$transaction`)
             │
             ▼
   PostgreSQL / Prisma ORM
     - `Booking`
     - `BookingLog`
     - `ActivityLog`
     - `User`
```

### Key Architectural Invariants
1. **NodeNext ESM Imports**: All internal module imports use explicit `.js` extensions.
2. **Decimal Handling**: Prices (`amount`) and durations (`durationHours`) use PostgreSQL `DECIMAL(12, 2)` / `DECIMAL(5, 2)` handled via Prisma `Prisma.Decimal`, preventing floating-point drift.
3. **Derived Invariant `endTime`**: `endTime` is strictly derived from `scheduledAt` and `durationHours`:
   $$\text{endTime} = \text{scheduledAt} + (\text{durationHours} \times 3600 \times 1000)$$
4. **Collision Prevention**: Active bookings (`PENDING`, `CONFIRMED`) cannot overlap for the same customer. Attempting to schedule during an overlapping window returns `409 Conflict`.
5. **State Machine Integrity**:
   - `PENDING` $\to$ `CONFIRMED`, `CANCELLED`
   - `CONFIRMED` $\to$ `COMPLETED`, `CANCELLED`
   - `COMPLETED` and `CANCELLED` are terminal states.
   - Transition to `COMPLETED` automatically marks `paymentStatus` as `PAID`.
6. **Double Atomic Sequences**: Booking creation atomically allocates:
   - `booking_code_seq`: `BKG-XXXX` (e.g. `BKG-1001`)
   - `invoice_code_seq`: `INV-XXXX` (e.g. `INV-10001`)
7. **Complete Audit Trail**: Every status transition or reschedule event writes:
   - `BookingLog` (domain timeline for booking lifecycle)
   - `ActivityLog` (system-wide administrative audit log)

---

## 3. Endpoints & API Contract

Base URL: `/api/v1/bookings`  
Security: `Authorization: Bearer <JWT>`

### 3.1. List Bookings
- **Route**: `GET /api/v1/bookings`
- **Query Parameters**:
  | Param | Type | Description |
  |---|---|---|
  | `page` | integer | Page number (default: 1, min: 1) |
  | `limit` | integer | Items per page (default: 10, max: 100) |
  | `search` | string | Free-text search matching `bookingCode`, `serviceName`, `customer.name`, or `customer.email` |
  | `status` | enum | `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED` |
  | `category` | enum | `VEHICLE_SERVICE`, `HOME_MAINTENANCE`, `ELECTRONICS`, `CONSULTING`, `OTHER` |
  | `service` | string | Partial/exact match on service name |
  | `when` | enum | `upcoming` ($scheduledAt \ge now$), `past` ($scheduledAt < now$) |
  | `startDate` | ISO string | Filter $scheduledAt \ge startDate$ |
  | `endDate` | ISO string | Filter $scheduledAt \le endDate$ |
  | `datePreset` | enum | `today`, `this_week`, `this_month`, `last_month`, `this_year` |
  | `sortBy` | string | Whitelisted: `scheduledAt`, `createdAt`, `amount`, `status`, `serviceName` |
  | `order` | enum | `asc` or `desc` (default: `desc`) |

- **Response (`200 OK`)**:
```json
{
  "statusCode": 200,
  "message": "Bookings retrieved successfully",
  "data": [
    {
      "id": "e2c347b7-7e9b-4497-b3f9-71578f14b31a",
      "bookingCode": "BKG-1001",
      "userId": "b47c0b29-23c2-46be-9171-ec59d09c6827",
      "customerName": "Alice Johnson",
      "customerEmail": "alice.johnson@example.com",
      "customerPhone": "+1-555-0101",
      "customerAvatarUrl": null,
      "serviceName": "Full Synthetic Oil Change",
      "category": "VEHICLE_SERVICE",
      "status": "CONFIRMED",
      "paymentStatus": "PENDING",
      "scheduledAt": "2026-10-10T14:00:00.000Z",
      "endTime": "2026-10-10T15:30:00.000Z",
      "durationHours": 1.5,
      "amount": 89.99,
      "location": "Bay #3, North Auto Center",
      "invoiceNumber": "INV-10001",
      "createdAt": "2026-10-01T10:00:00.000Z",
      "updatedAt": "2026-10-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### 3.2. Booking Statistics
- **Route**: `GET /api/v1/bookings/stats`
- **Response (`200 OK`)**:
```json
{
  "statusCode": 200,
  "message": "Booking statistics retrieved successfully",
  "data": {
    "totalBookings": 128,
    "activeBookings": 34,
    "upcomingBookings": 28,
    "completedBookings": 82,
    "cancelledBookings": 12,
    "totalRevenue": 14250.75,
    "totalBookingsChangePercent": 14.5,
    "completedBookingsChangePercent": 18.2,
    "revenueChangePercent": 12.0
  }
}
```

---

### 3.3. Booking Detail
- **Route**: `GET /api/v1/bookings/:bookingCode` (also accepts UUID)
- **Response (`200 OK`)**:
```json
{
  "statusCode": 200,
  "message": "Booking details retrieved successfully",
  "data": {
    "id": "e2c347b7-7e9b-4497-b3f9-71578f14b31a",
    "bookingCode": "BKG-1001",
    "serviceName": "Full Synthetic Oil Change",
    "category": "VEHICLE_SERVICE",
    "status": "CONFIRMED",
    "paymentStatus": "PENDING",
    "scheduledAt": "2026-10-10T14:00:00.000Z",
    "endTime": "2026-10-10T15:30:00.000Z",
    "durationHours": 1.5,
    "amount": 89.99,
    "location": "Bay #3, North Auto Center",
    "notes": "Client requested tyre pressure check as well",
    "invoiceNumber": "INV-10001",
    "customer": {
      "id": "b47c0b29-23c2-46be-9171-ec59d09c6827",
      "userCode": "USR-0001",
      "name": "Alice Johnson",
      "email": "alice.johnson@example.com",
      "phone": "+1-555-0101",
      "avatarUrl": null,
      "addressLine": "742 Evergreen Terrace",
      "city": "Springfield",
      "state": "OR",
      "country": "USA",
      "completedBookingsCount": 5
    },
    "lifecycleLogs": [
      {
        "id": "...",
        "status": "PENDING",
        "note": "Booking created",
        "changedBy": "Admin",
        "createdAt": "2026-10-01T10:00:00.000Z"
      },
      {
        "id": "...",
        "status": "CONFIRMED",
        "note": "Schedule confirmed by dispatch",
        "changedBy": "Admin",
        "createdAt": "2026-10-01T10:30:00.000Z"
      }
    ],
    "createdAt": "2026-10-01T10:00:00.000Z",
    "updatedAt": "2026-10-01T10:30:00.000Z"
  }
}
```

---

### 3.4. Create Booking
- **Route**: `POST /api/v1/bookings`
- **Request Body**:
```json
{
  "userId": "b47c0b29-23c2-46be-9171-ec59d09c6827",
  "serviceName": "Brake Rotor Replacement",
  "category": "VEHICLE_SERVICE",
  "scheduledAt": "2026-10-15T09:00:00.000Z",
  "durationHours": 2.0,
  "amount": 220.00,
  "location": "Bay #1",
  "notes": "Premium ceramic pads"
}
```
- **Validation**:
  - `userId`: must be a valid UUID of an active, non-deleted user.
  - `scheduledAt`: ISO 8601 string.
  - `durationHours`: optional, defaults to 1.5. Must be between 0.25 and 24.
  - `amount`: non-negative number.
  - Overlap check: returns `409 Conflict` if target user already has an active booking overlapping $[scheduledAt, endTime)$.
- **Response (`201 Created`)**: Returns created `BookingSummaryDto`.

---

### 3.5. Update / Reschedule / Lifecycle Transition
- **Route**: `PATCH /api/v1/bookings/:bookingCode`
- **Request Body**:
```json
{
  "status": "COMPLETED",
  "notes": "Work completed without issues",
  "cancellationReason": null
}
```
- **Validation & Business Logic**:
  - Rescheduling (`scheduledAt` or `durationHours`): Re-evaluates `endTime` and checks for time conflicts against other active bookings for that customer.
  - Status transition: Enforces state machine rules:
    - Cannot transition from `CANCELLED` or `COMPLETED`.
    - Transition to `COMPLETED` automatically sets `paymentStatus = PAID`.
    - Cancellation logs `cancellationReason`.
  - Generates `BookingLog` and `ActivityLog` records.
- **Response (`200 OK`)**: Returns updated `BookingSummaryDto`.

---

## 4. Concurrency & Collision Algorithm

```typescript
async checkTimeCollision(
  userId: string,
  scheduledAt: Date,
  endTime: Date,
  excludeBookingId?: string
): Promise<void> {
  const overlap = await prisma.booking.findFirst({
    where: {
      userId,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      AND: [
        { scheduledAt: { lt: endTime } },
        { endTime: { gt: scheduledAt } },
      ],
    },
  });

  if (overlap) {
    throw new ConflictException(
      `Scheduling conflict: User already has an active booking (${overlap.bookingCode}) scheduled between ${overlap.scheduledAt.toISOString()} and ${overlap.endTime.toISOString()}`
    );
  }
}
```

---

## 5. Testing & Verification

1. **Unit Tests (`src/bookings/bookings.service.spec.ts`)**:
   - Filter criteria construction (search, temporal, category, status).
   - Invariant `endTime` calculation.
   - Collision detection triggers `409 Conflict`.
   - Sequence generation and database transaction wrapper.
   - Illegal state machine transition rejection.
   - Automatic payment status settlement on completion.
2. **E2E Tests (`test/bookings.e2e-spec.ts`)**:
   - JWT Auth guard validation.
   - Listing, pagination, search, and sorting.
   - Temporal filtering (`when=upcoming`, `when=past`).
   - Detailed booking view with enriched customer metrics.
   - Full booking lifecycle (`PENDING` $\to$ `CONFIRMED` $\to$ `COMPLETED`).
   - Concurrency stress test: parallel creation requests verifying distinct, contiguous sequence numbers.
