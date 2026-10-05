# Database Design Specification (Implemented Schema)

> **Database Engine:** PostgreSQL 14+ / 16+  
> **ORM:** Prisma ORM 6.4.1  
> **Migration Version:** `20261005162303_init_adminhub_schema`  
> **Status:** Applied & Seeded in `miles_admin_dev` database.

---

## 1. Architectural Policies & Core Standards

### 1.1. Monetary / Decimal Policy
- **Database Storage:** All financial fields are stored as PostgreSQL `DECIMAL(12, 2)`.
- **Internal Calculations:** All additions, subtractions, fee calculations, and aggregations are performed strictly using `Prisma.Decimal` instances or `decimal.js`. **Converting monetary values to standard JavaScript floating-point numbers (`Number(decimal)`) during business calculations is strictly forbidden** to eliminate binary floating-point rounding errors (e.g. `0.1 + 0.2 != 0.3`).
- **Signed Amounts for Refunds:** Refunds are stored as signed negative values (e.g. `-120.00`). This ensures standard aggregation queries (`SUM(amount)`) naturally produce the correct net revenue.
- **API Response Formatting:** In API responses, monetary values are serialized consistently:
  - For frontend consumption: Clean numeric values rounded strictly to 2 decimal places (`1250.00`) as required by the frontend contracts (`amount: number`, `formatCurrency(val: number)`).
  - Raw strings or unrounded floats with floating-point noise are never output.

### 1.2. Business Code Generation Strategy (Concurrency-Safe)
- Business codes (`USR-0001`, `TXN-0017`, `BKG-0045`, `INV-10001`) must never collide under concurrent requests.
- **Anti-Pattern Prohibited:** Never use `SELECT MAX(...) + 1` or `findFirst(orderBy: desc) + 1`, which suffers from race conditions under concurrent transactions.
- **Implemented Solution:** Atomic PostgreSQL database sequences tracked directly in the migration history:
  - `user_code_seq`
  - `txn_code_seq`
  - `booking_code_seq`
  - `invoice_code_seq`
- During creation, services call `SELECT nextval('<seq_name>')` within the creation transaction, guaranteeing 100% collision-free, monotonic code allocation even under high concurrent load.

### 1.3. Date & Time / Timezone Policy
- **Persisted Format:** All timestamps use PostgreSQL `TIMESTAMPTZ(6)` (stored in UTC).
- **Date of Birth:** Stored as PostgreSQL `DATE` (`YYYY-MM-DD`).
- **Calculation Standardization:** All server-side calendar calculations (e.g. Month-over-Month comparisons, monthly chart buckets) operate strictly in UTC (`Date.UTC(year, month, 1)`):
  - Current calendar month: `[2026-10-01T00:00:00.000Z, now]` (inclusive).
  - Previous calendar month: `[2026-09-01T00:00:00.000Z, 2026-10-01T00:00:00.000Z)` (half-open interval: `>= start AND < end`).
- Eliminates server-local timezone discrepancies.

### 1.4. Booking Time Model & Invariants
- `scheduledAt` (`TIMESTAMPTZ`): Meeting start timestamp.
- `durationHours` (`DECIMAL(4, 2)`): Duration in hours (e.g., `1.50`).
- `endTime` (`TIMESTAMPTZ`): Meeting conclusion timestamp.
- **Strict Invariant:** `endTime = scheduledAt + (durationHours * 3600000 ms)`. This is enforced programmatically in the service layer on every create and reschedule mutation.

### 1.5. Audit History & Actor Tracking
- State transitions on transactions and bookings are audited in dedicated append-only tables:
  - `TransactionStatusHistory`: Records status milestones, notes, timestamps, and the acting administrator (`adminId` optional relation to `Admin`).
  - `BookingLog`: Records lifecycle milestones (`Booking Created`, `Status Set to Confirmed`, `Session Completed`, `Booking Cancelled`), descriptions, timestamps, and the acting administrator (`adminId`).
  - `ActivityLog`: Records user-centric security events (`Password Changed`, `Profile Updated`, `User Logged In`) linked to `userId`.

### 1.6. Identifier & Dual-Resolution Strategy
- Every record has a secure UUIDv4 primary key (`id`).
- Every business entity has a human-readable unique business code (`userCode`, `txnCode`, `reference`, `bookingCode`, `invoiceCode`).
- Route parameter handlers (`:code`) resolve records deterministically:
  - If parameter matches UUID format (`/^[0-9a-f]{8}-[0-9a-f]{4}-.../i`), query by `id`.
  - Otherwise, query by the respective unique business code (`userCode`, `txnCode`, `bookingCode`).

### 1.7. Soft Deletion & Referencing Integrity
- Soft delete (`deletedAt TIMESTAMPTZ`) is implemented **only** on `User`.
- Active user queries automatically filter `where: { deletedAt: null }`.
- When a user is soft-deleted, their financial transactions and bookings are **never deleted** (`onDelete: Restrict`), ensuring financial accounting immutability and compliance.
- Audit history tables use `onDelete: Cascade` relative to their parent transaction or booking.

---

## 2. Implemented Schema Definition

### 2.1. `Admin`
```prisma
model Admin {
  id                         String                     @id @default(uuid()) @db.Uuid
  name                       String                     @db.VarChar(100)
  email                      String                     @unique @db.VarChar(255)
  passwordHash               String                     @db.VarChar(255)
  role                       AdminRole                  @default(ADMIN)
  avatarUrl                  String?                    @db.VarChar(500)
  phone                      String?                    @db.VarChar(50)
  timezone                   String?                    @default("PST (UTC-08:00)") @db.VarChar(50)
  twoFactorEnabled           Boolean                    @default(true)
  createdAt                  DateTime                   @default(now()) @db.Timestamptz(6)
  updatedAt                  DateTime                   @updatedAt @db.Timestamptz(6)

  transactionStatusHistories TransactionStatusHistory[]
  bookingLogs                BookingLog[]

  @@map("admins")
}
```

### 2.2. `User`
```prisma
model User {
  id               String        @id @default(uuid()) @db.Uuid
  userCode         String        @unique @db.VarChar(20)
  firstName        String        @db.VarChar(100)
  lastName         String        @db.VarChar(100)
  email            String        @unique @db.VarChar(255)
  phone            String        @db.VarChar(50)
  dateOfBirth      DateTime?     @db.Date
  addressLine      String?       @db.VarChar(255)
  city             String?       @db.VarChar(100)
  state            String?       @db.VarChar(100)
  country          String?       @db.VarChar(100)
  avatarUrl        String?       @db.VarChar(500)
  role             UserRole      @default(VIEWER)
  status           UserStatus    @default(ACTIVE)
  twoFactorEnabled Boolean       @default(false)
  lastLoginAt      DateTime?     @db.Timestamptz(6)
  joinedAt         DateTime      @default(now()) @db.Timestamptz(6)
  createdAt        DateTime      @default(now()) @db.Timestamptz(6)
  updatedAt        DateTime      @updatedAt @db.Timestamptz(6)
  deletedAt        DateTime?     @db.Timestamptz(6)

  transactions     Transaction[]
  bookings         Booking[]
  activities       ActivityLog[]

  @@index([deletedAt, status, role])
  @@index([deletedAt, createdAt(sort: Desc)])
  @@map("users")
}
```

### 2.3. `Transaction`
```prisma
model Transaction {
  id            String                     @id @default(uuid()) @db.Uuid
  txnCode       String                     @unique @db.VarChar(30)
  reference     String                     @unique @db.VarChar(50)
  userId        String                     @db.Uuid
  type          TransactionType            @default(PAYMENT)
  status        TransactionStatus          @default(PENDING)
  amount        Decimal                    @db.Decimal(12, 2)
  currency      String                     @default("USD") @db.VarChar(3)
  productName   String                     @db.VarChar(255)
  paymentMethod String                     @db.VarChar(100)
  gatewayFee    Decimal                    @default(0.00) @db.Decimal(12, 2)
  subtotal      Decimal                    @db.Decimal(12, 2)
  total         Decimal                    @db.Decimal(12, 2)
  settledAt     DateTime?                  @db.Timestamptz(6)
  createdAt     DateTime                   @default(now()) @db.Timestamptz(6)
  updatedAt     DateTime                   @updatedAt @db.Timestamptz(6)

  user          User                       @relation(fields: [userId], references: [id], onDelete: Restrict)
  statusHistory TransactionStatusHistory[]

  @@index([userId, createdAt(sort: Desc)])
  @@index([status, createdAt(sort: Desc)])
  @@index([type, status])
  @@index([createdAt(sort: Desc)])
  @@map("transactions")
}
```

### 2.4. `TransactionStatusHistory`
```prisma
model TransactionStatusHistory {
  id            String            @id @default(uuid()) @db.Uuid
  transactionId String            @db.Uuid
  adminId       String?           @db.Uuid
  status        TransactionStatus
  note          String            @db.VarChar(500)
  createdAt     DateTime          @default(now()) @db.Timestamptz(6)

  transaction   Transaction       @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  admin         Admin?            @relation(fields: [adminId], references: [id], onDelete: SetNull)

  @@index([transactionId, createdAt(sort: Asc)])
  @@map("transaction_status_histories")
}
```

### 2.5. `Booking`
```prisma
model Booking {
  id            String        @id @default(uuid()) @db.Uuid
  bookingCode   String        @unique @db.VarChar(30)
  userId        String        @db.Uuid
  serviceName   String        @db.VarChar(255)
  category      String        @db.VarChar(100)
  scheduledAt   DateTime      @db.Timestamptz(6)
  durationHours Decimal       @default(1.50) @db.Decimal(4, 2)
  endTime       DateTime      @db.Timestamptz(6)
  location      String        @default("Virtual - Zoom Link Provided") @db.VarChar(255)
  customerNotes String?       @db.Text
  status        BookingStatus @default(PENDING)
  amount        Decimal       @db.Decimal(12, 2)
  paymentStatus PaymentStatus @default(PENDING)
  paymentMethod String        @db.VarChar(100)
  invoiceCode   String        @unique @db.VarChar(30)
  createdAt     DateTime      @default(now()) @db.Timestamptz(6)
  updatedAt     DateTime      @updatedAt @db.Timestamptz(6)

  user          User          @relation(fields: [userId], references: [id], onDelete: Restrict)
  lifecycleLogs BookingLog[]

  @@index([userId, scheduledAt(sort: Desc)])
  @@index([status, scheduledAt(sort: Asc)])
  @@index([category, scheduledAt])
  @@index([scheduledAt(sort: Asc)])
  @@map("bookings")
}
```

### 2.6. `BookingLog`
```prisma
model BookingLog {
  id          String   @id @default(uuid()) @db.Uuid
  bookingId   String   @db.Uuid
  adminId     String?  @db.Uuid
  event       String   @db.VarChar(100)
  description String   @db.VarChar(500)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)

  booking     Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  admin       Admin?   @relation(fields: [adminId], references: [id], onDelete: SetNull)

  @@index([bookingId, createdAt(sort: Asc)])
  @@map("booking_logs")
}
```

### 2.7. `ActivityLog`
```prisma
model ActivityLog {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid
  action      String   @db.VarChar(100)
  description String   @db.VarChar(500)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
  @@map("activity_logs")
}
```

### 2.8. `Alert`
```prisma
model Alert {
  id          String        @id @default(uuid()) @db.Uuid
  title       String        @db.VarChar(255)
  description String        @db.VarChar(500)
  severity    AlertSeverity @default(INFO)
  isResolved  Boolean       @default(false)
  createdAt   DateTime      @default(now()) @db.Timestamptz(6)

  @@index([isResolved, createdAt(sort: Desc)])
  @@map("alerts")
}
```

---

## 3. Enumerations

| Enum | Values | Semantic Meaning |
|---|---|---|
| `AdminRole` | `SUPER_ADMIN`, `ADMIN` | Internal admin tier |
| `UserRole` | `ADMIN`, `EDITOR`, `VIEWER` | Customer role tier in app directory |
| `UserStatus` | `ACTIVE`, `INACTIVE`, `SUSPENDED` | Account lifecycle state |
| `TransactionType` | `PAYMENT`, `REFUND`, `TRANSFER` | Accounting entry category |
| `TransactionStatus` | `COMPLETED`, `PENDING`, `FAILED`, `REFUNDED` | Processing settlement status |
| `BookingStatus` | `CONFIRMED`, `PENDING`, `COMPLETED`, `CANCELLED` | Appointment lifecycle state |
| `PaymentStatus` | `PAID`, `PENDING`, `FAILED` | Invoice billing ledger status |
| `AlertSeverity` | `INFO`, `WARNING`, `CRITICAL` | Dashboard operational alert tone |

---

## 4. Search & Index Strategy

### 4.1. Index Justifications (B-Tree Specificity)
Standard PostgreSQL B-tree indexes are applied exclusively where access patterns benefit:
1. **Exact & Prefix Lookups:** Unique indexes on `userCode`, `txnCode`, `bookingCode`, `invoiceCode`, and `email` serve point lookups in $O(\log N)$ time.
2. **Composite Filtering:**
   - `User(deletedAt, status, role)`: Direct match on active user directory filtered by role and status.
   - `Transaction(type, status)`: Accelerates type/status filter permutations on `/transactions`.
3. **Sorting & Range Queries:**
   - `User(deletedAt, createdAt DESC)`: Accelerates default reverse-chronological pagination.
   - `Transaction(createdAt DESC)`: Accelerates default transaction list sorting and recent transactions table.
   - `Booking(scheduledAt ASC)`: Accelerates default chronological calendar order.
4. **Foreign Key Joins & Compound Timelines:**
   - `Transaction(userId, createdAt DESC)`: Loads customer's related ledger in user detail and transaction detail without a full table scan.
   - `Booking(userId, scheduledAt DESC)`: Loads customer's recent bookings and completed bookings count.
   - `TransactionStatusHistory(transactionId, createdAt ASC)`: Pulls ordered processing history steps.
   - `BookingLog(bookingId, createdAt ASC)`: Pulls ordered lifecycle logs.
   - `ActivityLog(userId, createdAt DESC)`: Pulls user's recent activity feed.
   - `Alert(isResolved, createdAt DESC)`: Pulls active alerts for the dashboard widget.

*Note on Substring Search:* Arbitrary `ILIKE '%term%'` substring searches on names or descriptions are resolved using case-insensitive PostgreSQL text comparison (`mode: 'insensitive'`). For small-to-medium dataset sizes (< 100k rows), sequential scans are fast. Trigram GIN indexes (`pg_trgm`) can be introduced in production if dataset size expands.

---

## 5. Seed Strategy & Data Synthesis

The database seeder (`prisma/seed.ts`) populates realistic development data:
- **Admin:** 1 Super Admin (`admin@miles.io` / `Admin@123`, bcrypt 10 rounds).
- **Users:** 50 realistic users with complete profiles (name, email, phone, avatar, address, city, state, role, status, 2FA status, birth date).
- **Transactions:** 120 transactions spread across a 12-month historical window with realistic amounts ($35.00 – $2400.00), signed refund amounts, product names, payment methods, gateway fees, and 326 child status history steps.
- **Bookings:** 60 bookings spread across past and future (+30 days), realistic service categories, duration hours, derived end times, payment statuses, and 161 child lifecycle logs.
- **Activity Logs:** 45 activity logs across sample users.
- **Alerts:** 3 active operational alerts across CRITICAL, WARNING, and INFO tiers.
- **Idempotency:** Seeder cleans existing rows in relational order and restarts database sequences, preventing duplicate proliferation across runs.
