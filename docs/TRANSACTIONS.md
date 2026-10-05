# Transactions Module Documentation

The Transactions module manages all financial ledger records, payment events, state machine lifecycle transitions, audit logging, and customer invoice tracking for Miles Admin Hub.

---

## 1. Endpoints Overview

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/v1/transactions` | Paginated transactions with search, multi-filters, and sorting | Bearer JWT |
| `GET` | `/api/v1/transactions/stats` | Header summary statistics (total, revenue, avg, success rate) | Bearer JWT |
| `GET` | `/api/v1/transactions/:id` | Full transaction detail by UUID or `TXN-XXXX` code | Bearer JWT |
| `POST` | `/api/v1/transactions` | Create transaction with atomic `TXN-XXXX` code generation | Bearer JWT |
| `PATCH` | `/api/v1/transactions/:id/status` | Update transaction status with lifecycle validation and history | Bearer JWT |

---

## 2. Query Parameters (`GET /api/v1/transactions`)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number (1-indexed, minimum: 1) |
| `limit` | integer | `10` | Page limit (minimum: 1, maximum: 100) |
| `q` / `search` | string | `undefined` | Search term across `txnCode`, `reference`, `productName`, `paymentMethod`, and customer fields |
| `status` | string | `undefined` | Filter by `COMPLETED`, `PENDING`, `FAILED`, `REFUNDED` (also accepts `"paid"` alias) |
| `type` | string | `undefined` | Filter by `PAYMENT`, `REFUND`, `TRANSFER` |
| `paymentMethod` | string | `undefined` | Filter by payment provider substring (e.g. `Visa`, `Mastercard`, `PayPal`) |
| `userId` | string | `undefined` | Filter by user UUID or `USR-XXXX` code |
| `minAmount` | number | `undefined` | Minimum transaction amount (>= 0) |
| `maxAmount` | number | `undefined` | Maximum transaction amount (>= 0) |
| `date` | string | `undefined` | Preset filter: `'7'` (last 7 days), `'30'` (last 30 days), `'all'` |
| `dateFrom` | ISO date | `undefined` | Inclusive start date (00:00:00.000Z) |
| `dateTo` | ISO date | `undefined` | Inclusive end date (23:59:59.999Z) |
| `sortBy` | string | `createdAt` | Whitelisted: `createdAt`, `amount`, `total`, `txnCode`, `status`, `type`, `date`, `customerName` |
| `sortOrder` / `order` | string | `desc` | Direction: `asc` or `desc` (case-insensitive) |

---

## 3. Date Filtering Semantics

- **Preset Date (`date`):**
  - `'7'`: Filters `createdAt >= (now - 7 days)`
  - `'30'`: Filters `createdAt >= (now - 30 days)`
  - `'all'`: Clears date boundary
- **Custom Date Range (`dateFrom`, `dateTo`):**
  - `dateFrom`: Normalized to start of day (00:00:00.000Z)
  - `dateTo`: Normalized to end of day (23:59:59.999Z)
  - **Validation:** If `dateFrom > dateTo`, throws `400 Bad Request` (`"dateFrom must be before or equal to dateTo"`).

---

## 4. Status Lifecycle State Machine

The transaction status lifecycle enforces non-arbitrary, business-safe state transitions:

```
          ┌─────────────┐
          │   PENDING   │
          └──────┬──────┘
           /     │     \
          /      │      \
         v       v       v
 ┌───────────┐ ┌──────┐ ┌──────────┐
 │ COMPLETED │ │FAILED│ │ REFUNDED │ (Terminal)
 └─────┬─────┘ └──┬───┘ └──────────┘
       │          │ (retry)
       │          v
       │     ┌─────────┐
       │     │ PENDING │
       │     └─────────┘
       v
 ┌──────────┐
 │ REFUNDED │ (Terminal)
 └──────────┘
```

- **Allowed Transitions:**
  - `PENDING` -> `COMPLETED`, `FAILED`, `REFUNDED`
  - `COMPLETED` -> `REFUNDED`
  - `FAILED` -> `PENDING` (re-try checkout)
  - `REFUNDED` -> (terminal; no transitions permitted)
- **Settlement Rule:** Transitioning to `COMPLETED` automatically timestamps `settledAt = now()` if not already set.
- **Violation Behavior:** Invalid transitions (e.g. `COMPLETED` -> `FAILED` or `REFUNDED` -> `COMPLETED`) throw `400 Bad Request`.

---

## 5. Decimal and Monetary Policy

- **Database Storage:** Stored as PostgreSQL `DECIMAL(12, 2)`.
- **Internal Arithmetic:** All internal math (gateway fee calculation, net subtotal derivation, percentage aggregations) strictly uses Prisma `Decimal` instances (`.mul()`, `.minus()`, `.plus()`, `.toDecimalPlaces(2)`).
- **Floating Point Prevention:** JavaScript native float calculations are strictly avoided during financial operations.
- **API Serialization:** Serialized in DTOs to standard 2-decimal numbers (`toDecimalNumber()`) matching the frontend's numerical expectations (`Transaction.amount: number`, `formatCurrency(val)`).

---

## 6. Business Transaction Code Generation

- **Sequence:** Native PostgreSQL sequence `txn_code_seq`.
- **Format:** `TXN-` followed by zero-padded integer to at least 4 digits (e.g. `TXN-0001`, `TXN-0121`).
- **Concurrency Safety:** Allocated via `SELECT nextval('txn_code_seq')`.
- **Reference Allocation:** If client omits `reference`, the server generates `ref_${Date.now()}_${seq}` to guarantee global uniqueness.

---

## 7. Audit & Activity Logging

All write operations execute within atomic Prisma transactions:

1. **Transaction Created (`POST /api/v1/transactions`):**
   - Appends initial entry to `TransactionStatusHistory` (`status: initialStatus`, `note: "Transaction record initialized"`, `adminId`).
   - Appends audit event to `ActivityLog` (`action: "TRANSACTION_CREATED"`, `description: "Transaction TXN-XXXX created for user ... with amount $..."`).
2. **Status Changed (`PATCH /api/v1/transactions/:id/status`):**
   - Appends entry to `TransactionStatusHistory` (`status: newStatus`, `note: requestedNote`, `adminId`).
   - Appends audit event to `ActivityLog` (`action: "TRANSACTION_STATUS_UPDATED"`).

---

## 8. Query Performance and Index Decisions

- **Selective Joins:** Queries include only necessary relations (`include: { user: true }`).
- **Bounded Ledger:** Detail endpoint limits related customer transactions to `take: 5` ordered by `createdAt: desc`.
- **Database Aggregations:** `/api/v1/transactions/stats` computes total volume and averages using PostgreSQL `_sum` and `_avg` database primitives rather than loading records into application memory.
- **Index Alignment:** Leverages existing database indexes:
  - `idx_transactions_user_created` (`userId`, `createdAt desc`)
  - `idx_transactions_status_created` (`status`, `createdAt desc`)
  - `idx_transactions_type_status` (`type`, `status`)
  - `idx_transactions_created` (`createdAt desc`)
  - `transactions_txn_code_key` (unique)
  - `transactions_reference_key` (unique)

---

## 9. Frontend Integration Mapping

- **List Component:** `adminhub/src/features/transactions/components/transactions-view.tsx`
- **Columns:**
  - `TRANSACTION ID`: maps to `txnCode`
  - `USER`: maps to `customerName`, `customerEmail`, `customerAvatar`
  - `TYPE`: maps to `type` (`PAYMENT`, `REFUND`, `TRANSFER`)
  - `AMOUNT`: maps to `amount`
  - `STATUS`: maps to `status` (`COMPLETED`, `PENDING`, `FAILED`, `REFUNDED`)
  - `DATE & TIME`: maps to `createdAt`
- **Stats Cards:** `TransactionsDesktopView` maps directly to `GET /api/v1/transactions/stats`:
  - `Total Transactions`: `stats.total`
  - `Total Volume`: `stats.revenue`
  - `Avg. Transaction`: `stats.avg`
  - `Success Rate`: `stats.successRate`
