# System Alerts & Notifications Module Documentation

> **Module:** `src/alerts`  
> **Route Prefix:** `/api/v1/alerts`  
> **Security:** Protected via `JwtAuthGuard` and `RolesGuard`  
> **Database Entity:** `Alert` (Prisma ORM with PostgreSQL)

---

## 1. Overview

The **System Alerts & Notifications Module** (`src/alerts`) manages platform-wide operational notices, infrastructure alerts, security warnings, and administrative notifications. It powers both the **System Alerts Widget** on the executive dashboard and the **Notifications Menu Bell** in the top navigation bar.

### Core Capabilities:
- **Comprehensive Querying & Filtering**: Full pagination, keyword search across title and description, severity filtering (`INFO`, `WARNING`, `CRITICAL`), resolution status filtering (`isResolved`), and customizable sorting (`createdAt`, `severity`, `title`).
- **Aggregate Statistics**: Real-time counts of total, active, resolved, critical, warning, and info alerts (`GET /api/v1/alerts/stats`).
- **Interactive Notifications Feed**: Unread counts and UI badges (`tone: 'brand' | 'success' | 'warning' | 'danger' | 'info'`) tailored to the frontend topbar notifications dropdown (`GET /api/v1/alerts/notifications-feed`).
- **Administrative Incident Creation**: Validated alert creation with configurable severity and automatic tone assignment (`POST /api/v1/alerts`).
- **Granular Lifecycle Transitions**: Single alert resolution (`PATCH /:id/resolve`), batch resolution by UUID array (`PATCH /batch-resolve`), and platform-wide bulk resolution (`PATCH /resolve-all`).
- **Fine-Grained Role-Based Access Control (RBAC)**: Enforced via `RolesGuard` and `@Roles()` decorator. High-impact operations such as permanent deletion (`DELETE /:id`) require `SUPER_ADMIN` privileges.

---

## 2. Architecture & Directory Structure

```text
src/alerts/
├── dto/
│   ├── alert-response.dto.ts               # Envelope, item, resolve, batch, and delete DTOs
│   ├── alert-stats-response.dto.ts         # Aggregate counts DTO
│   ├── alerts-query.dto.ts                 # Pagination, search, severity, and resolution filters
│   ├── batch-resolve-alert.dto.ts          # Array of UUIDs for bulk resolution
│   ├── create-alert.dto.ts                 # Creation payload with min/max length validation
│   ├── notifications-feed-response.dto.ts  # Topbar bell feed response DTO
│   └── update-alert.dto.ts                 # Partial update payload
├── alerts.controller.ts                    # REST endpoints with Swagger annotations & RBAC
├── alerts.module.ts                        # NestJS module definition exporting AlertsService
├── alerts.service.ts                       # Business logic & Prisma ORM queries
└── alerts.service.spec.ts                  # Unit test suite (21 unit tests)
```

---

## 3. Endpoints Reference

### 3.1. `GET /api/v1/alerts`
- **Description:** Retrieve paginated list of alerts.
- **Query Parameters:**
  - `page` (number, default 1, min 1)
  - `limit` (number, default 10, min 1, max 100)
  - `search` / `q` (string, case-insensitive keyword search in title & description)
  - `severity` (`INFO` | `WARNING` | `CRITICAL`)
  - `isResolved` (`true` | `false`)
  - `sortBy` (`createdAt` | `severity` | `title`, default `createdAt`)
  - `order` (`asc` | `desc`, default `desc`)
- **Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "title": "Server capacity at 92%",
        "description": "Scale compute resources immediately",
        "severity": "CRITICAL",
        "tone": "danger",
        "isResolved": false,
        "time": "2 hours ago",
        "createdAt": "2026-10-05T18:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
  ```

### 3.2. `GET /api/v1/alerts/stats`
- **Description:** Summary metrics of alerts.
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "total": 10,
      "active": 3,
      "resolved": 7,
      "critical": 1,
      "warning": 1,
      "info": 1
    }
  }
  ```

### 3.3. `GET /api/v1/alerts/notifications-feed`
- **Description:** Topbar notification bell feed with unread counter.
- **Query Parameters:** `limit` (optional number, default 5, max 20)
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "unreadCount": 3,
      "notifications": [
        {
          "id": "a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
          "title": "Server capacity at 92%",
          "body": "Scale compute resources immediately",
          "tone": "danger",
          "severity": "CRITICAL",
          "time": "2 hours ago",
          "unread": true,
          "createdAt": "2026-10-05T18:00:00.000Z"
        }
      ]
    }
  }
  ```

### 3.4. `POST /api/v1/alerts`
- **Description:** Create an operational or administrative alert.
- **Allowed Roles:** `SUPER_ADMIN`, `ADMIN`
- **Request Body:**
  ```json
  {
    "title": "Scheduled Database Maintenance",
    "description": "Failover drill scheduled for Sunday morning at 02:00 UTC",
    "severity": "INFO"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "data": {
      "id": "a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
      "title": "Scheduled Database Maintenance",
      "description": "Failover drill scheduled for Sunday morning at 02:00 UTC",
      "severity": "INFO",
      "tone": "info",
      "isResolved": false,
      "time": "Just now",
      "createdAt": "2026-10-06T09:30:00.000Z"
    }
  }
  ```

### 3.5. `GET /api/v1/alerts/:id`
- **Description:** Retrieve details of an individual alert by UUID.
- **Response (`200 OK`):** Returns single alert object in `data` envelope.
- **Errors:** `400 Bad Request` (invalid UUID), `404 Not Found`.

### 3.6. `PATCH /api/v1/alerts/:id`
- **Description:** Partially update alert properties.
- **Allowed Roles:** `SUPER_ADMIN`, `ADMIN`
- **Request Body:** `{ "title"?: string, "description"?: string, "severity"?: AlertSeverity, "isResolved"?: boolean }`
- **Response (`200 OK`):** Updated alert object in `data` envelope.

### 3.7. `PATCH /api/v1/alerts/:id/resolve`
- **Description:** Mark individual alert as resolved.
- **Allowed Roles:** `SUPER_ADMIN`, `ADMIN`
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "id": "a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
      "isResolved": true,
      "message": "Alert marked as resolved"
    }
  }
  ```

### 3.8. `PATCH /api/v1/alerts/batch-resolve`
- **Description:** Bulk resolve an array of alerts.
- **Allowed Roles:** `SUPER_ADMIN`, `ADMIN`
- **Request Body:** `{ "ids": ["uuid-1", "uuid-2"] }`
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "resolvedCount": 2,
      "ids": ["uuid-1", "uuid-2"],
      "message": "Successfully resolved 2 alerts"
    }
  }
  ```

### 3.9. `PATCH /api/v1/alerts/resolve-all`
- **Description:** Mark all active unresolved alerts as resolved.
- **Allowed Roles:** `SUPER_ADMIN`, `ADMIN`
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "resolvedCount": 5,
      "message": "All active alerts marked as resolved"
    }
  }
  ```

### 3.10. `DELETE /api/v1/alerts/:id`
- **Description:** Permanently delete an alert from the database.
- **Allowed Roles:** `SUPER_ADMIN` (Enforces RBAC; returns `403 Forbidden` for standard `ADMIN`)
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "id": "a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
      "message": "Alert deleted successfully"
    }
  }
  ```

---

## 4. Security & RBAC Implementation

Fine-grained role permissions are managed through:
- `src/common/decorators/roles.decorator.ts`: `@Roles(...roles: AdminRole[])`
- `src/common/guards/roles.guard.ts`: `RolesGuard` validating `request.user.role` against required roles.
- `JwtStrategy`: Verifies token signature and checks database presence of admin account.
