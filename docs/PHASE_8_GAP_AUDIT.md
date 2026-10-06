# Phase 8 Gap Audit & Requirement Matrix: System Alerts & Notifications

> **Phase Focus:** Dedicated System Alerts & Notifications Module, Alert Lifecycle Management, Feed for Topbar Bell, Batch Resolution, and Fine-Grained Role-Based Access Control (RBAC).  
> **Source Documents:** `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DASHBOARD_REQUIREMENTS.md`, and Frontend (`src/features/dashboard/components/system-alerts.tsx`, `src/components/layout/notifications-menu.tsx`).

---

## 1. Executive Summary

In Phases 1 through 7, core operational modules (Auth, Users, Transactions, Bookings, Dashboard) were established. The Dashboard module introduced minimal read access to unresolved alerts (`GET /dashboard/alerts`) and single-item resolution (`PATCH /dashboard/alerts/:id/resolve`).

However, the administrative console requires a dedicated, full-lifecycle **Alerts & Notifications System** capable of:
1. Comprehensive search, filtering by severity and resolution status, sorting, and pagination across all alerts.
2. System alert aggregate statistics (`total`, `active`, `resolved`, `critical`, `warning`, `info`).
3. Administrative alert creation (`POST /api/v1/alerts`) for system warnings, scheduled maintenance notices, and operational announcements.
4. Full alert detail, update, and deletion with RBAC enforcement (`SUPER_ADMIN` / `ADMIN`).
5. Batch resolution (`PATCH /api/v1/alerts/batch-resolve`) and resolve-all (`PATCH /api/v1/alerts/resolve-all`) workflows.
6. A unified Notifications Feed (`GET /api/v1/alerts/notifications-feed`) delivering structured unread counts and UI badges to power the topbar notifications bell dropdown.
7. Fulfillment of the deferred Fine-Grained Role Permissions (RBAC) via `RolesGuard` and `@Roles()` decorator.

---

## 2. Gap Analysis Matrix

| Requirement Area | Current Repository State | Target Phase 8 Implementation | Status |
|---|---|---|---|
| **Dedicated Alerts Module** | Alerts only queried inside `DashboardService` | Dedicated `src/alerts/` module with `AlertsController` and `AlertsService` mounted at `/api/v1/alerts` | **NEW** |
| **Alerts Query & Filtering** | Only `findMany({ where: { isResolved: false }, take: 10 })` | Full pagination (`page`, `limit`), case-insensitive search in title/description, severity filter, resolution status filter, customizable sort field and direction | **NEW** |
| **Alerts Summary Statistics** | None | `GET /api/v1/alerts/stats` returning counts for `total`, `active`, `resolved`, `critical`, `warning`, `info` | **NEW** |
| **Notifications Menu Feed** | Static mock data in frontend topbar (`notifications-menu.tsx`) | `GET /api/v1/alerts/notifications-feed` providing unread counter, tone mapping (`brand`, `warning`, `danger`, `info`), and formatted feed items | **NEW** |
| **Manual Alert Creation** | Only pre-seeded rows in DB | `POST /api/v1/alerts` with DTO validation (`title`, `description`, `severity`) and automatic relative tone mapping | **NEW** |
| **Alert Detail & Update** | None | `GET /api/v1/alerts/:id` and `PATCH /api/v1/alerts/:id` allowing updating title, description, severity, and resolution status | **NEW** |
| **Batch Resolution** | Only single-item resolution in dashboard | `PATCH /api/v1/alerts/batch-resolve` accepting array of UUIDs, and `PATCH /api/v1/alerts/resolve-all` | **NEW** |
| **Alert Deletion** | None | `DELETE /api/v1/alerts/:id` removing alerts, restricted to `SUPER_ADMIN` | **NEW** |
| **Role-Based Access Control (RBAC)** | Only basic `JwtAuthGuard` | `RolesGuard` and `@Roles()` decorator verifying `SUPER_ADMIN` vs `ADMIN` permissions | **NEW** |
| **Backward Compatibility** | Existing `/dashboard/alerts` and `/dashboard/overview` | Zero breaking changes; `DashboardService` alerts endpoints remain fully operational | **PRESERVED** |

---

## 3. API Contract Specification (Phase 8 Additions)

### 3.1. `GET /api/v1/alerts`
- **Query Parameters**:
  - `page` (default 1, min 1)
  - `limit` (default 10, min 1, max 100)
  - `search` (optional string, searches title and description case-insensitively)
  - `severity` (optional `AlertSeverity`: `INFO`, `WARNING`, `CRITICAL`)
  - `isResolved` (optional boolean string: `'true'` | `'false'`)
  - `sortBy` (optional: `'createdAt'` | `'severity'` | `'title'`, default `'createdAt'`)
  - `order` (optional: `'asc'` | `'desc'`, default `'desc'`)
- **Response**: Standard pagination envelope `{ data: AlertResponseDto[], meta: PaginationMetaDto }`.

### 3.2. `GET /api/v1/alerts/stats`
- **Response**:
  ```json
  {
    "total": 3,
    "active": 3,
    "resolved": 0,
    "critical": 1,
    "warning": 1,
    "info": 1
  }
  ```

### 3.3. `GET /api/v1/alerts/notifications-feed`
- **Query Parameters**: `limit` (default 5, max 20).
- **Response**:
  ```json
  {
    "unreadCount": 3,
    "notifications": [
      {
        "id": "uuid",
        "title": "Server capacity at 92%",
        "body": "Scale compute resources",
        "tone": "danger",
        "severity": "CRITICAL",
        "time": "2 hours ago",
        "unread": true,
        "createdAt": "2026-10-05T18:00:00.000Z"
      }
    ]
  }
  ```

### 3.4. `POST /api/v1/alerts`
- **Role**: `SUPER_ADMIN`, `ADMIN`
- **Request Body**:
  ```json
  {
    "title": "Scheduled DB Maintenance",
    "description": "Database failover drill planned for 02:00 UTC",
    "severity": "INFO"
  }
  ```
- **Response**: `201 Created` with `AlertResponseDto`.

### 3.5. `GET /api/v1/alerts/:id`
- **Response**: `200 OK` with `AlertResponseDto`, or `404 Not Found`.

### 3.6. `PATCH /api/v1/alerts/:id`
- **Request Body**: Partial update (`title`, `description`, `severity`, `isResolved`).
- **Response**: `200 OK` with updated `AlertResponseDto`.

### 3.7. `PATCH /api/v1/alerts/:id/resolve`
- **Response**: `200 OK` with `{ id, isResolved: true, message: "Alert marked as resolved" }`.

### 3.8. `PATCH /api/v1/alerts/batch-resolve`
- **Request Body**: `{ "ids": ["uuid-1", "uuid-2"] }`.
- **Response**: `200 OK` with `{ resolvedCount: 2, ids: [...] }`.

### 3.9. `PATCH /api/v1/alerts/resolve-all`
- **Response**: `200 OK` with `{ resolvedCount: number, message: "All active alerts marked as resolved" }`.

### 3.10. `DELETE /api/v1/alerts/:id`
- **Role**: `SUPER_ADMIN` (Enforces RBAC)
- **Response**: `200 OK` with `{ message: "Alert deleted successfully" }`.

---

## 4. Quality & Verification Gates
1. **ESM Compliance**: Explicit `.js` relative imports on all new and updated files.
2. **Decimal & Date Standards**: ISO 8601 timestamps, clean string formatting.
3. **Unit Tests**: Full unit test coverage in `src/alerts/alerts.service.spec.ts` and `src/common/guards/roles.guard.spec.ts`.
4. **E2E Tests**: Full E2E suite in `test/alerts.e2e-spec.ts` verifying authentication, role enforcement, validation, and CRUD operations.
5. **No Regressions**: All 179 existing tests must remain 100% green.
