# Phase 10 Gap Audit: Admin Management, Profile Security, Workspace Settings, Reports & System Activities

> **Phase Focus:** Administrative Suite & Reporting (Admin Profile Self-Service, Admin Directory Management, Workspace Settings, Dedicated Monthly Reports, and System Activity Audit Stream).  
> **Source Documents:** `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DATABASE_DESIGN.md`, `docs/GAP_ANALYSIS.md`, and Frontend (`src/features/profile/components/profile-view.tsx`, `src/features/dashboard/components/dashboard-view.tsx`).

---

## 1. Executive Summary

Phases 1 through 9 delivered the core operational monolith: Authentication, Customer Directory (Users), Financial Ledger (Transactions), Service Appointments (Bookings), Executive Metrics & Charts (Dashboard), Incident Management (Alerts & Notifications), and Production Hardening & Docker Containerization.

However, several administrative capabilities specified in the requirement matrix and demonstrated in the frontend are either unmounted, mock-only, or lack backend endpoints:
1. **Admin Profile Security & Self-Service**: The frontend `ProfileView` provides "Edit profile" and "Change password" buttons, plus 2FA preference display. The backend currently only has `POST /auth/login` and read-only `GET /auth/me`.
2. **Admin Directory & Lifecycle Management**: In `prisma/schema.prisma`, `AdminRole` defines `SUPER_ADMIN` and `ADMIN`. There is currently no administrative directory API for `SUPER_ADMIN` to view all administrators, invite/create administrators, update roles, or manage administrative access.
3. **Workspace Settings**: The dashboard `tab=settings` (`SettingsPanel`) displays "Workspace Name" and "Support Email" form fields with "Save changes" functionality. There is currently no backend persistence or API endpoint for workspace settings.
4. **Dedicated Monthly Reports**: The dashboard `tab=reports` (`ReportsPanel`) displays a 12-month table of monthly orders, revenue volume, and average order value with a totals row. Currently, this data is only partially derived from chart timeseries and lacks a dedicated server-aggregated reports endpoint.
5. **System Activity & Audit Stream**: The Prisma schema contains an `ActivityLog` table automatically populated across user, transaction, and booking mutations, but there is no top-level endpoint (`GET /api/v1/activities`) for administrators to query, search, and audit system activities.

Closing these 5 gaps in Phase 10 completes the administrative suite and reporting surface of the Miles Admin Hub platform.

---

## 2. Comprehensive Gap Analysis Matrix

| Requirement Area | Current Repository State | Target Phase 10 Implementation | Status |
|---|---|---|---|
| **1. Admin Profile Updates** | Read-only `GET /api/v1/auth/me` | `PATCH /api/v1/auth/profile` allowing the signed-in admin to update `name`, `phone`, `timezone`, and `avatarUrl`. | **NEW** |
| **2. Admin Password Change** | None (only bcrypt verification at login) | `POST /api/v1/auth/change-password` verifying `currentPassword`, enforcing password complexity, hashing new password with bcrypt (10 rounds). | **NEW** |
| **3. Admin Preferences (2FA)** | Read-only in `GET /auth/me` | `PATCH /api/v1/auth/preferences` allowing toggling `twoFactorEnabled`. | **NEW** |
| **4. Admin Directory (RBAC)** | Seeded `Admin` rows in DB without directory API | `GET /api/v1/admins` with pagination, keyword search, role filtering; `GET /api/v1/admins/:id`. Restricted to `SUPER_ADMIN`. | **NEW** |
| **5. Admin Creation & Role Updates** | None | `POST /api/v1/admins` and `PATCH /api/v1/admins/:id/role` restricted to `SUPER_ADMIN`. Invariant: Cannot self-demote. | **NEW** |
| **6. Admin Account Deletion** | None | `DELETE /api/v1/admins/:id` restricted to `SUPER_ADMIN`. Invariants: Cannot delete self; cannot delete the sole remaining `SUPER_ADMIN`. | **NEW** |
| **7. Workspace Settings API** | Static markup in frontend `SettingsPanel` | Dedicated `src/settings` module with `GET /api/v1/settings` and `PATCH /api/v1/settings` backed by `WorkspaceSetting` PostgreSQL table. | **NEW** |
| **8. Dedicated Reports API** | Rendered from chart points | `GET /api/v1/dashboard/reports` returning 12-month orders, revenue, average order value, and summary totals row. | **NEW** |
| **9. System Activity Log API** | `ActivityLog` entries only queried inside user detail | `GET /api/v1/activities` with pagination, filtering by `userId`, `action`, `dateFrom`, `dateTo`, and keyword search. | **NEW** |

---

## 3. Database & Architectural Design

### 3.1. Database Additions: `WorkspaceSetting`
A new table in `prisma/schema.prisma` will hold the single workspace configuration row:
```prisma
model WorkspaceSetting {
  id            String   @id @default(uuid()) @db.Uuid
  workspaceName String   @default("AdminHub") @db.VarChar(100)
  supportEmail  String   @default("support@adminhub.io") @db.VarChar(255)
  currency      String   @default("USD") @db.VarChar(10)
  timezone      String   @default("PST (UTC-08:00)") @db.VarChar(50)
  updatedAt     DateTime @updatedAt @db.Timestamptz(6)

  @@map("workspace_settings")
}
```
A new versioned Prisma migration `20261006090000_add_workspace_settings` will be generated and deployed deterministically.

### 3.2. Endpoint Contracts
1. `PATCH /api/v1/auth/profile`: DTO with optional `name`, `phone`, `timezone`, `avatarUrl`.
2. `POST /api/v1/auth/change-password`: DTO with `currentPassword` (min 6) and `newPassword` (min 6).
3. `PATCH /api/v1/auth/preferences`: DTO with `twoFactorEnabled` (boolean).
4. `GET /api/v1/admins`: Paginated list of administrators, search in name/email, role filter.
5. `GET /api/v1/admins/:id`: Single admin detail.
6. `POST /api/v1/admins`: Create admin (`name`, `email`, `password`, `role`, `phone`, `timezone`).
7. `PATCH /api/v1/admins/:id/role`: Update admin role (`SUPER_ADMIN`, `ADMIN`).
8. `DELETE /api/v1/admins/:id`: Delete admin account with invariant protection.
9. `GET /api/v1/settings`: Retrieve workspace configuration.
10. `PATCH /api/v1/settings`: Update workspace name, support email, currency, timezone.
11. `GET /api/v1/dashboard/reports`: Monthly report table with orders, revenue, AOV, and totals.
12. `GET /api/v1/activities`: Paginated system activity audit log stream.

---

## 4. Verification & Testing Strategy
- Unit tests for Auth profile updates, password change, Admin management invariants, Settings service, Reports calculation, and Activities query.
- E2E tests for all 12 new endpoints, validating permissions (403 for non-SUPER_ADMIN on admin management and settings), validation errors, and lifecycle transitions.
- Full regression run: zero regressions across existing 114 unit tests and 129 E2E tests.
