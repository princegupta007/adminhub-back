# Gap Analysis & Risk Assessment

> **Purpose:** Identify discrepancies between the existing frontend implementation, Figma mockups, and assignment specifications, and document mitigation strategies.

---

## 1. Frontend Functionality Needing Backend Support

| Feature Area | Current Frontend State | Required Backend Support | Gap / Action |
|---|---|---|---|
| **Authentication** | Demo guest login button bypassing credentials check (`src/features/auth/components/login-view.tsx`). | `POST /api/v1/auth/login` validating against bcrypt hashes, returning signed JWT; `GET /api/v1/auth/me`. | Real JWT issuance, Passport strategy, bcrypt verification, rate-limited login. |
| **User Management** | Fetches DummyJSON `/users` and filters in browser memory (`UsersApi.getUsers`). | `GET /api/v1/users` with PostgreSQL server-side pagination, ILIKE search, role/status filters, and sorting. | Transfer filtering/sorting/pagination from browser to PostgreSQL indexes. |
| **User Profile Aggregates** | Detail view (`user-detail-view.tsx`) hardcodes static `TRANSACTIONS`, `BOOKINGS`, and `ACTIVITY_LOG` arrays. | `GET /api/v1/users/:code` joining top 5 transactions, top 5 bookings, and top 5 activity logs. | Prisma relation queries returning compound user detail object. |
| **User Mutations** | "Add User", "Edit Profile", "Suspend User" trigger `ComingSoonDialog`. | `POST /api/v1/users`, `PATCH /api/v1/users/:code`, `DELETE /api/v1/users/:code` (soft delete). | Full validation DTOs, unique code generation (`USR-0001`), soft-delete logic. |
| **Transaction History** | Mapped from DummyJSON `/carts` with client-side pseudorandom derivations (`derive.ts`). | `GET /api/v1/transactions` with server-side filtering by type, status, amount range, and date range. | Real transactional queries backed by PostgreSQL `Decimal(12, 2)`. |
| **Transaction Detail** | Hardcodes invoice items, gateway fees, static processing history steps, and static ledger table. | `GET /api/v1/transactions/:code` returning invoice data, customer summary, `TransactionStatusHistory` timeline, and related user transactions. | Relational query with child status history and sibling user transactions. |
| **Booking Management** | Mapped from DummyJSON `/todos` with client-side pseudorandom derivations. | `GET /api/v1/bookings` with filters for status, service/category, and upcoming/past windows. | Database queries with status and scheduledAt filtering. |
| **Booking Detail** | Hardcodes meeting notes, customer completed booking count ("12 Total Bookings Completed"), and lifecycle logs. | `GET /api/v1/bookings/:code` returning meeting logistics, customer overview with `_count.bookings`, and `BookingLog` timeline. | Prisma relation queries with subquery count for completed customer bookings. |
| **Dashboard Metrics** | Browser computes all KPIs and charts by loading all carts, todos, and users into memory (`stats.ts`). | `GET /api/v1/dashboard/stats`, `GET /api/v1/dashboard/charts`, `GET /api/v1/dashboard/alerts`, `GET /api/v1/dashboard/health`. | Database-level SQL aggregations (`SUM`, `COUNT`, `GROUP BY`, date truncations). |

---

## 2. Figma Functionality Not Visible in Frontend

1. **State Mutation Forms:**
   - *Figma:* Shows input modals for creating users, updating booking logistics, rescheduling dates, and cancelling reservations.
   - *Frontend:* Replaced all mutation forms with a generic `coming-soon-dialog.tsx` placeholder.
   - *Backend Obligation:* The backend must provide full DTO-validated endpoints (`POST`, `PATCH`, `DELETE`) ready for frontend integration.
2. **Transaction Status Workflow:**
   - *Figma:* Shows the ability to transition a transaction between Pending, Completed, Refunded, or Failed.
   - *Frontend:* Only has static visual display badges.
   - *Backend Obligation:* `PATCH /api/v1/transactions/:code/status` with status transition logic and audit trail generation in `TransactionStatusHistory`.
3. **Reschedule / Cancel Booking Workflow:**
   - *Figma:* "Reschedule" and "Cancel Booking" action buttons with date pickers.
   - *Frontend:* Buttons open "Coming Soon" dialog.
   - *Backend Obligation:* `PATCH /api/v1/bookings/:code` allowing rescheduling (`scheduledAt`) or status updates (`CANCELLED`) with automatic `BookingLog` logging.

---

## 3. Assignment Requirements Not Represented in Frontend

1. **Strict Production Auth & Global Guard:**
   - Assignment mandates JWT authentication on all routes except login and health. Frontend had no JWT header handling.
2. **PostgreSQL Migrations Only:**
   - Assignment forbids `db push` or manual DDL; requires strict Prisma migration history.
3. **Seeded Admin Account:**
   - Assignment mandates `admin@miles.io` / `Admin@123` with 10 bcrypt salt rounds.
4. **Calculated Month-over-Month (MoM) Percentages:**
   - Assignment mandates server-side MoM % calculations compared to the previous calendar month. Frontend used a rolling 30-day delta estimate.
5. **Human-Readable Business Codes:**
   - Assignment specifies `USR-0001`, `TXN-0017`, `ref_992743055`, `BKG-0045`, `INV-98943`. Frontend generated `#TXN-1082` style hashes from cart IDs.

---

## 4. Missing Information & Ambiguous Behavior

| Item | Ambiguity | Selected Resolution |
|---|---|---|
| **User Deletion Impact** | If a user is deleted, what happens to their historical bookings and transactions? | **Soft deletion via `deletedAt`**. Transactions and bookings retain their foreign keys (`onDelete: Restrict`). Users are excluded from standard list queries, but historical invoices retain complete integrity. |
| **Duration & End Time** | How is booking duration stored and displayed? | Store `durationHours` as `Decimal(4, 2)` (e.g. 1.50) and persist/derive `endTime = scheduledAt + (durationHours * 60 minutes)`. |
| **Refund Accounting** | How are refund amounts represented? | Refunds are signed negative decimals in `Transaction.amount` (e.g. `-120.00`). Revenue aggregations naturally subtract refunds when summing amounts. |
| **Search Case Sensitivity** | How should search handle uppercase/lowercase names and codes? | Use PostgreSQL `mode: 'insensitive'` (ILIKE) across name, email, and code fields. |

---

## 5. Potential Implementation Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Decimal Precision Leaks** | JavaScript treats numbers as 64-bit IEEE floats, risking `0.1 + 0.2 = 0.30000000000000004` or serialization as raw Decimal objects. | Use a dedicated monetary serializer/helper that formats all currency numbers to 2 decimal places (`Number(val.toFixed(2))`) before response serialization. |
| **Timezone Skew in MoM Calculations** | Month boundary calculations (e.g. Sep 30 vs Oct 1) varying based on server timezone. | All calendar date calculations execute strictly in UTC (`new Date(Date.UTC(year, month, 1))`). |
| **Query Performance under Pagination** | Large offset pagination (`OFFSET 1000`) degrading query performance. | Composite indexes on `(deletedAt, createdAt DESC)` for users, `(createdAt DESC)` for transactions, and `(scheduledAt ASC)` for bookings. Max page limit capped at 100. |
| **Seeded Data Staleness** | If seed dates are hardcoded to fixed calendar months, chart and MoM queries might become empty as time moves forward. | The database seed script will dynamically generate dates relative to the current execution date across a 12-month window. |
