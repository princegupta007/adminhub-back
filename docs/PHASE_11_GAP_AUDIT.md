# Phase 11 Gap Audit: Enterprise Workflows, Bulk Operations, Data Exports & Omni-Search

> **Phase Focus:** Enterprise Workflows, Bulk Operations, Data Exports, and Unified Omni-Search.  
> **Source Documents:** `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DATABASE_DESIGN.md`, `docs/GAP_ANALYSIS.md`, `docs/ASSUMPTIONS.md`, and Frontend (`src/features/users/components/users-desktop-view.tsx`, `src/features/transactions/components/transactions-desktop-view.tsx`, `src/features/bookings/components/bookings-desktop-view.tsx`, `src/components/common/topbar-search.tsx`).

---

## 1. Executive Summary

Phases 1 through 10 established the complete operational backend monolith: Authentication & Security, Customer Directory, Financial Ledger, Service Appointments, Dashboard KPIs & Analytics, System Alerts & Notifications, Production Hardening & Docker Containerization, and Administrative Management Suite.

However, an exhaustive audit comparing the frontend components (`E:\projects\adminhub`), Figma mockups, and `docs/ASSUMPTIONS.md` reveals critical interactive gaps:
1. **Bulk Operations on User Directory**: The frontend `UsersDesktopView` features a bulk actions toolbar triggered upon selecting rows ("Change Role", "Suspend", "Delete"), documented as an open requirement in `docs/ASSUMPTIONS.md` Section C.2. The backend currently only offers single-resource mutations.
2. **Data Export Streams (RFC 4180 CSV)**: Both `TransactionsDesktopView` ("Export CSV") and `BookingsDesktopView` ("Export List") feature download buttons with `<Download>` icons that currently open "Coming Soon" modals. The backend lacks CSV streaming endpoints with proper MIME types (`text/csv`) and `Content-Disposition` attachment headers.
3. **Explicit Action Workflows**: In transaction and booking details, users interact with discrete action workflows ("Refund Transaction", "Reschedule", "Cancel Booking"). Providing dedicated semantic endpoints with explicit validation, collision guards, and audit trail generation standardizes the API contract with zero ambiguity.
4. **Global Omni-Search**: The topbar search bar (`<TopbarSearch />`) requires live database querying across multiple models (Users, Transactions, Bookings) to allow administrators to search across the entire platform in real time.

Phase 11 implements these high-priority capabilities to close all remaining interactive and data integration gaps.

---

## 2. Comprehensive Gap Analysis Matrix

| Requirement Area | Current Repository State | Target Phase 11 Implementation | Status |
|---|---|---|---|
| **1. Bulk User Status Update** | Only single `PATCH /users/:code` | `POST /api/v1/users/bulk/status` accepting `userCodes` array and target `status`. Atomic batch execution with audit logging. | **NEW** |
| **2. Bulk User Role Update** | Only single `PATCH /users/:code` | `POST /api/v1/users/bulk/role` accepting `userCodes` array and target `role`. Restricted to `SUPER_ADMIN`. | **NEW** |
| **3. Bulk User Soft Deletion** | Only single `DELETE /users/:code` | `POST /api/v1/users/bulk/delete` accepting `userCodes` array for batch soft deletion. Restricted to `SUPER_ADMIN`. | **NEW** |
| **4. Transactions CSV Export** | None | `GET /api/v1/transactions/export` streaming RFC 4180 CSV matching active filter/search query parameters. Includes CSV injection protection. | **NEW** |
| **5. Bookings CSV Export** | None | `GET /api/v1/bookings/export` streaming RFC 4180 CSV matching active filter/search parameters. | **NEW** |
| **6. Users CSV Export** | None | `GET /api/v1/users/export` streaming RFC 4180 CSV of non-deleted customer records matching query parameters. | **NEW** |
| **7. Monthly Reports CSV Export** | None | `GET /api/v1/dashboard/reports/export` streaming 12-month report table with totals in CSV format. | **NEW** |
| **8. Dedicated Transaction Refund** | Only general `PATCH /transactions/:id/status` | `POST /api/v1/transactions/:id/refund` verifying refundable state, setting `REFUNDED`, adding audit histories, and logging activity. | **NEW** |
| **9. Dedicated Booking Reschedule** | Only general `PATCH /bookings/:id` | `POST /api/v1/bookings/:id/reschedule` validating future datetime, checking time overlap collision, and adding lifecycle logs. | **NEW** |
| **10. Dedicated Booking Cancellation** | Only general `PATCH /bookings/:id` | `POST /api/v1/bookings/:id/cancel` verifying non-terminal state, setting `CANCELLED`, and recording cancellation reason in lifecycle log. | **NEW** |
| **11. Unified Global Omni-Search** | Individual module search only | `GET /api/v1/search?q=...` returning cross-entity matches across Users, Transactions, and Bookings. | **NEW** |

---

## 3. Architectural & Implementation Specifications

### 3.1. Bulk Operations
- **Atomic Operations:** Uses Prisma transactions to ensure consistent batch processing.
- **Audit Trails:** Iterates affected users to append individual `ActivityLog` records preserving complete audit history.
- **Input Validation:** Enforces minimum 1 and maximum 100 codes per batch request to prevent memory spikes.
- **RBAC:**
  - Status updates: `ADMIN` or `SUPER_ADMIN`.
  - Role updates: `SUPER_ADMIN` only.
  - Deletions: `SUPER_ADMIN` only.

### 3.2. CSV Data Export Standards
- **RFC 4180 Compliance:** Proper field quoting, comma delimiters, CRLF (`\r\n`) newlines.
- **Formula Injection Mitigation:** Prepends single quote `'` to any cell starting with `=`, `+`, `-`, `@`, `\t`, `\r` to prevent Excel formula execution vulnerabilities.
- **HTTP Headers:**
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="<domain>_export_<date>.csv"`

### 3.3. Omni-Search Engine
- Cross-queries:
  - Users by `firstName`, `lastName`, `email`, `userCode`.
  - Transactions by `txnCode`, `reference`, `productName`.
  - Bookings by `bookingCode`, `invoiceCode`, `serviceName`.
- Capped at top 5 matches per domain to ensure sub-50ms latency.

---

## 4. Verification & Testing Strategy
- Unit test coverage for:
  - Bulk service operations (status, role, delete, error handling, invariants).
  - CSV generation utility (escaping, injection protection, formatting).
  - Refund, Reschedule, Cancel workflows.
  - Omni-search aggregation.
- E2E test coverage for:
  - All 11 new endpoints.
  - Role-based authorization controls (403 for unauthorized roles).
  - CSV download header checks and body contents.
  - Concurrency and conflict handling.
