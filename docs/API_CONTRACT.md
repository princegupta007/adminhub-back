# API Contract Specification

> **Base URL:** `/api/v1`  
> **Protocol:** HTTPS / REST  
> **Content-Type:** `application/json`  
> **Swagger Documentation:** Mounted at `/api/docs` covering 100% of endpoints.

---

## 1. Global Conventions

### 1.1. Authentication & Security
- **Global Guard:** All endpoints require a valid Bearer JWT in the `Authorization` header (`Authorization: Bearer <token>`), **except**:
  - `POST /api/v1/auth/login` (Public, strict rate limiting)
  - `GET /health` and `GET /api/v1/health` (Public, no auth)
- **Passswords:** Hashed with bcrypt (10 rounds). Password hashes are **strictly excluded** from all responses.
- **Rate Limiting:** Global throttling (e.g. 100 req/min), with strict login throttling (5 req/min) returning `429 Too Many Requests`.

### 1.2. Response Envelopes
- **Collection / List Endpoints:**
  Always return the standard pagination envelope:
  ```json
  {
    "data": [ ... ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 42,
      "totalPages": 5
    }
  }
  ```
  *Note:* Empty results return HTTP `200 OK` with `data: []` and `meta.total: 0`. Never return `404` for empty search or filter results.
  *Pagination Parameters:* `page` (default `1`, min `1`), `limit` (default `10`, min `1`, max `100`).

- **Single Resource Endpoints:**
  Always return the resource object enclosed in a `data` envelope:
  ```json
  {
    "data": { ... }
  }
  ```
  *(Public health checks `/health` return raw `{ status: "ok", uptime, timestamp }`).*

### 1.3. Global Error Format
All errors are normalized via a centralized exception filter:
```json
{
  "statusCode": 400,
  "message": [
    "email must be an email address",
    "password must be longer than or equal to 6 characters"
  ],
  "error": "Bad Request",
  "timestamp": "2026-10-05T20:00:00.000Z",
  "path": "/api/v1/auth/login"
}
```
Standard status codes:
- `400 Bad Request`: Validation failure (field-level messages array).
- `401 Unauthorized`: Missing, invalid, or expired JWT token.
- `403 Forbidden`: Authenticated user lacks required permissions.
- `404 Not Found`: Targeted resource does not exist.
- `409 Conflict`: Unique constraint violation (e.g., email or code conflict).
- `429 Too Many Requests`: Throttler limit exceeded.
- `500 Internal Server Error`: Generic internal failure; stack trace never leaked to client.

### 1.4. Data Formatting Standards
- **Dates & Times:** ISO 8601 strings (e.g., `"2026-10-05T14:30:00.000Z"`).
- **Monetary Values:** JSON numbers with 2 decimal places (e.g., `1250.00`, `-350.50`). Never raw string decimals or floats with arbitrary precision.
- **Percentage Deltas:** Server-calculated float values representing month-over-month (MoM) change vs previous calendar month.

---

## 2. Authentication Endpoints

### 2.1. `POST /api/v1/auth/login`
- **Purpose:** Authenticate dashboard administrator with email and password.
- **Auth:** Public (Strict rate limiting: max 5 attempts/minute).
- **Request Body (`LoginDto`):**
  ```json
  {
    "email": "admin@miles.io",
    "password": "Admin@123"
  }
  ```
- **Validation:**
  - `email`: Required, valid email string, lowercase trimmed.
  - `password`: Required, string, min 6 characters.
- **Response (`200 OK`):**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "1d",
    "admin": {
      "id": "c1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
      "name": "Sarah Jenkins",
      "email": "admin@miles.io",
      "role": "SUPER_ADMIN",
      "avatarUrl": "https://i.pravatar.cc/150?u=admin",
      "twoFactorEnabled": true
    }
  }
  ```
- **Errors:** `400 Bad Request`, `401 Unauthorized` ("Invalid email or password"), `429 Too Many Requests`.

### 2.2. `GET /api/v1/auth/me`
- **Purpose:** Retrieve the profile of the currently authenticated administrator.
- **Auth:** Bearer JWT required.
- **Response (`200 OK`):**
  ```json
  {
    "id": "c1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
    "name": "Sarah Jenkins",
    "email": "admin@miles.io",
    "role": "SUPER_ADMIN",
    "avatarUrl": "https://i.pravatar.cc/150?u=admin",
    "phone": "+1 (555) 014-2210",
    "timezone": "PST (UTC-08:00)",
    "twoFactorEnabled": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-10-05T12:00:00.000Z"
  }
  ```
- **Errors:** `401 Unauthorized`.

### 2.3. `PATCH /api/v1/auth/profile`
- **Purpose:** Update the current administrator's display name, phone, timezone, and avatar URL.
- **Auth:** Bearer JWT required.
- **Request Body (`UpdateProfileDto`):**
  ```json
  {
    "name": "Sarah Jenkins",
    "phone": "+1 (555) 014-2210",
    "timezone": "PST (UTC-08:00)",
    "avatarUrl": "https://i.pravatar.cc/150?u=admin_sarah"
  }
  ```
- **Response (`200 OK`):** Returns updated admin profile.
- **Errors:** `400 Bad Request`, `401 Unauthorized`.

### 2.4. `POST /api/v1/auth/change-password`
- **Purpose:** Update the account password after validating the current password.
- **Auth:** Bearer JWT required.
- **Request Body (`ChangePasswordDto`):**
  ```json
  {
    "currentPassword": "CurrentPassword123",
    "newPassword": "NewSecurePassword456!"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "message": "Password updated successfully"
    }
  }
  ```
- **Errors:** `400 Bad Request` (Invalid current password or identical new password), `401 Unauthorized`.

### 2.5. `PATCH /api/v1/auth/preferences`
- **Purpose:** Update account security preferences (two-factor authentication toggle).
- **Auth:** Bearer JWT required.
- **Request Body (`UpdatePreferencesDto`):**
  ```json
  {
    "twoFactorEnabled": true
  }
  ```
- **Response (`200 OK`):** Returns updated admin profile.
- **Errors:** `400 Bad Request`, `401 Unauthorized`.

---

## 3. Dashboard Endpoints

### 3.1. `GET /api/v1/dashboard/stats`
- **Purpose:** Retrieve top-level KPI metrics comparing current calendar month to previous calendar month.
- **Auth:** Bearer JWT required.
- **Response (`200 OK`):**
  ```json
  {
    "kpis": [
      {
        "id": "users",
        "label": "Total Users",
        "value": 1420,
        "format": "number",
        "changePct": 12.5,
        "trend": "up",
        "hint": "vs previous month"
      },
      {
        "id": "revenue",
        "label": "Total Revenue",
        "value": 482500.00,
        "format": "fullCurrency",
        "changePct": 8.3,
        "trend": "up",
        "hint": "vs previous month"
      },
      {
        "id": "bookings",
        "label": "Active Bookings",
        "value": 310,
        "format": "number",
        "changePct": -2.4,
        "trend": "down",
        "hint": "vs previous month"
      },
      {
        "id": "pending",
        "label": "Pending Transactions",
        "value": 18,
        "format": "number",
        "changePct": 5.0,
        "trend": "up",
        "hint": "vs previous month"
      }
    ],
    "totals": {
      "revenue": 482500.00,
      "pendingRevenue": 14200.00,
      "orders": 1240,
      "paidOrders": 1180,
      "pendingOrders": 18,
      "failedOrders": 42,
      "users": 1420,
      "bookings": 480,
      "confirmedBookings": 210,
      "completedBookings": 230,
      "averageOrderValue": 408.90,
      "bookingSuccessRate": 91.67
    }
  }
  ```

### 3.2. `GET /api/v1/dashboard/charts`
- **Purpose:** Fetch time-series aggregation data for dashboard charts based on a selected time range.
- **Auth:** Bearer JWT required.
- **Query Params:**
  - `range` (optional, enum: `7d`, `1m`, `3m`, `6m`, `1y`; default: `6m`)
- **Response (`200 OK`):**
  ```json
  {
    "range": "6m",
    "revenueByPeriod": [
      { "period": "May 2026", "revenue": 68400.00, "orders": 185 },
      { "period": "Jun 2026", "revenue": 74200.00, "orders": 198 },
      { "period": "Jul 2026", "revenue": 81500.00, "orders": 214 },
      { "period": "Aug 2026", "revenue": 86300.00, "orders": 220 },
      { "period": "Sep 2026", "revenue": 92100.00, "orders": 235 },
      { "period": "Oct 2026", "revenue": 80000.00, "orders": 188 }
    ],
    "ordersByStatus": [
      { "status": "COMPLETED", "label": "Paid", "count": 1180, "amount": 482500.00 },
      { "status": "PENDING", "label": "Pending", "count": 18, "amount": 14200.00 },
      { "status": "FAILED", "label": "Failed", "count": 42, "amount": 16500.00 },
      { "status": "REFUNDED", "label": "Refunded", "count": 12, "amount": -4800.00 }
    ],
    "bookingsByStatus": [
      { "status": "CONFIRMED", "label": "Confirmed", "count": 140, "amount": 28500.00 },
      { "status": "PENDING", "label": "Pending", "count": 45, "amount": 9200.00 },
      { "status": "COMPLETED", "label": "Completed", "count": 230, "amount": 46000.00 },
      { "status": "CANCELLED", "label": "Cancelled", "count": 65, "amount": 12800.00 }
    ],
    "bookingsByCategory": [
      { "category": "Cleaning", "bookings": 160, "revenue": 24000.00 },
      { "category": "Appliances", "bookings": 95, "revenue": 18500.00 },
      { "category": "Electrical", "bookings": 78, "revenue": 14200.00 },
      { "category": "Plumbing", "bookings": 64, "revenue": 11800.00 },
      { "category": "Design", "bookings": 45, "revenue": 16500.00 }
    ],
    "topProducts": [
      { "title": "iPhone 13 Pro", "thumbnail": "https://...", "unitsSold": 142, "revenue": 141858.00 },
      { "title": "MacBook Air M2", "thumbnail": "https://...", "unitsSold": 88, "revenue": 105512.00 }
    ]
  }
  ```

### 3.3. `GET /api/v1/dashboard/alerts`
- **Purpose:** Retrieve active operational alerts.
- **Auth:** Bearer JWT required.
- **Response (`200 OK`):**
  ```json
  [
    {
      "id": "a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
      "title": "Server capacity at 92%",
      "description": "Scale compute resources",
      "severity": "CRITICAL",
      "isResolved": false,
      "createdAt": "2026-10-05T18:00:00.000Z"
    },
    {
      "id": "b2f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
      "title": "18 transactions pending",
      "description": "Pending review",
      "severity": "WARNING",
      "isResolved": false,
      "createdAt": "2026-10-05T15:00:00.000Z"
    }
  ]
  ```

### 3.4. `GET /api/v1/dashboard/health`
- **Purpose:** Retrieve system uptime and response metrics for the infrastructure widget.
- **Auth:** Bearer JWT required.
- **Response (`200 OK`):**
  ```json
  {
    "uptime": "99.8%",
    "avgResponseTime": "142ms",
    "activeSessions": 3241,
    "database": "connected",
    "timestamp": "2026-10-05T20:00:00.000Z"
  }
  ```

### 3.5. `GET /api/v1/dashboard/recent-transactions`
- **Purpose:** Quick lookup of the most recent transactions for the dashboard table.
- **Auth:** Bearer JWT required.
- **Query Params:** `limit` (default: `6`, max: `20`).
- **Response (`200 OK`):**
  ```json
  [
    {
      "id": "e3f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
      "txnCode": "TXN-1082",
      "customerName": "Aubrey Wagner",
      "customerEmail": "aubrey.wagner@example.com",
      "customerAvatar": "https://i.pravatar.cc/150?u=12",
      "type": "PAYMENT",
      "amount": 1028.19,
      "status": "COMPLETED",
      "paymentMethod": "Credit Card (Visa ending in 4582)",
      "createdAt": "2026-10-05T18:45:00.000Z"
    }
  ]
  ```

### 3.6. `GET /api/v1/dashboard/upcoming-bookings`
- **Purpose:** Retrieve scheduled future appointments for the dashboard upcoming widget.
- **Auth:** Bearer JWT required.
- **Query Params:** `limit` (default: `5`, max: `20`).

### 3.7. `GET /api/v1/dashboard/overview`
- **Purpose:** Consolidated multi-widget payload delivering stats, charts, alerts, health, recent transactions, and upcoming bookings in a single query.
- **Auth:** Bearer JWT required.
- **Query Params:** `range` (`7d`, `1m`, `3m`, `6m`, `1y`; default: `6m`).

### 3.8. `GET /api/v1/dashboard/reports`
- **Purpose:** Retrieve 12-month historical reporting breakdown powering the Reports panel (`tab=reports`).
- **Auth:** Bearer JWT required.
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "rows": [
        {
          "month": "Jan 2026",
          "orders": 12,
          "revenue": 14500.00,
          "averageOrderValue": 1208.33,
          "growth": 8.5
        }
      ],
      "totals": {
        "totalOrders": 120,
        "totalRevenue": 152000.00,
        "overallAverageOrderValue": 1266.67,
        "averageMonthlyRevenue": 12666.67
      }
    }
  }
  ```
- **Errors:** `401 Unauthorized`.

---

## 4. Users Endpoints

### 4.1. `GET /api/v1/users`
- **Purpose:** Paginated list of users with search, filtering, and sorting.
- **Auth:** Bearer JWT required.
- **Query Params (`UsersQueryDto`):**
  - `page` (number, default: 1)
  - `limit` (number, default: 10, max: 100)
  - `q` / `search` (string, optional: searches `firstName`, `lastName`, `email`, `userCode`)
  - `role` (enum: `ADMIN`, `EDITOR`, `VIEWER`, optional)
  - `status` (enum: `ACTIVE`, `INACTIVE`, `SUSPENDED`, optional)
  - `sortBy` (enum: `name`, `email`, `joinDate`, `lastActive`, `status`, `role`, `createdAt`; default: `createdAt`)
  - `order` / `sortDirection` (enum: `asc`, `desc`; default: `desc`)
- **Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "d4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "userCode": "USR-0001",
        "name": "Sarah Jenkins",
        "firstName": "Sarah",
        "lastName": "Jenkins",
        "email": "sarah.jenkins@example.com",
        "phone": "+1 (555) 014-2210",
        "avatarUrl": "https://i.pravatar.cc/150?u=1",
        "role": "ADMIN",
        "status": "ACTIVE",
        "twoFactorEnabled": true,
        "joinDate": "2024-03-15T00:00:00.000Z",
        "lastActive": "2026-10-05T19:30:00.000Z",
        "createdAt": "2024-03-15T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1420,
      "totalPages": 142
    }
  }
  ```

### 4.2. `GET /api/v1/users/stats`
- **Purpose:** Overview statistics for the users directory header.
- **Auth:** Bearer JWT required.
- **Response (`200 OK`):**
  ```json
  {
    "total": 1420,
    "active": 1285,
    "inactive": 95,
    "suspended": 40,
    "newThisMonth": 64,
    "totalChangePct": 12.5,
    "activeChangePct": 8.1
  }
  ```

### 4.3. `GET /api/v1/users/:code`
- **Purpose:** Full aggregate user profile by `userCode` (e.g. `USR-0001`) or UUID.
- **Auth:** Bearer JWT required.
- **Response (`200 OK`):**
  ```json
  {
    "id": "d4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
    "userCode": "USR-0001",
    "name": "Sarah Jenkins",
    "firstName": "Sarah",
    "lastName": "Jenkins",
    "email": "sarah.jenkins@example.com",
    "phone": "+1 (555) 014-2210",
    "dateOfBirth": "1992-05-18",
    "addressLine": "742 Evergreen Terrace",
    "city": "Springfield",
    "state": "OR",
    "country": "USA",
    "avatarUrl": "https://i.pravatar.cc/150?u=1",
    "role": "ADMIN",
    "status": "ACTIVE",
    "twoFactorEnabled": true,
    "joinedAt": "2024-03-15T00:00:00.000Z",
    "lastLoginAt": "2026-10-05T19:30:00.000Z",
    "recentTransactions": [
      {
        "id": "e3f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "txnCode": "TXN-0017",
        "date": "2026-10-04T14:20:00.000Z",
        "amount": 1250.00,
        "status": "COMPLETED"
      }
    ],
    "recentBookings": [
      {
        "id": "b5f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "bookingCode": "BKG-0045",
        "service": "Home Deep Cleaning",
        "scheduledAt": "2026-10-12T10:00:00.000Z",
        "status": "CONFIRMED"
      }
    ],
    "recentActivity": [
      {
        "id": "a6f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "title": "Password Changed",
        "desc": "Security credential refreshed via self-service",
        "time": "2026-10-04T11:15:00.000Z"
      }
    ]
  }
  ```
- **Errors:** `404 Not Found`.

### 4.4. `POST /api/v1/users`
- **Purpose:** Create a new user record.
- **Auth:** Bearer JWT required.
- **Request Body (`CreateUserDto`):**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1 (555) 019-8833",
    "role": "VIEWER",
    "status": "ACTIVE",
    "dateOfBirth": "1995-08-22",
    "addressLine": "123 Market St",
    "city": "San Francisco",
    "state": "CA",
    "country": "USA",
    "avatarUrl": "https://i.pravatar.cc/150?u=johndoe",
    "twoFactorEnabled": false
  }
  ```
- **Validation:**
  - `firstName`, `lastName`: Required, non-empty string.
  - `email`: Required, valid email, unique.
  - `phone`: Required, valid phone string.
  - `role`: Optional enum (`ADMIN`, `EDITOR`, `VIEWER`), default: `VIEWER`.
  - `status`: Optional enum (`ACTIVE`, `INACTIVE`, `SUSPENDED`), default: `ACTIVE`.
- **Response (`201 Created`):** Returns created user object.
- **Errors:** `400 Bad Request`, `409 Conflict` (Email already registered).

### 4.5. `PATCH /api/v1/users/:code`
- **Purpose:** Update profile details or status of an existing user.
- **Auth:** Bearer JWT required.
- **Request Body (`UpdateUserDto`):** Partial fields of `CreateUserDto`.
- **Response (`200 OK`):** Returns updated user object.
- **Errors:** `400 Bad Request`, `404 Not Found`, `409 Conflict`.

### 4.6. `DELETE /api/v1/users/:code`
- **Purpose:** Soft delete a user (sets `deletedAt = now()`, excludes from regular queries).
- **Auth:** Bearer JWT required.
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "success": true,
      "message": "User USR-0001 soft deleted successfully"
    }
  }
  ```
- **Errors:** `404 Not Found`.

---

## 5. Transactions Endpoints

### 5.1. `GET /api/v1/transactions`
- **Purpose:** Paginated financial transactions list with search, filtering, and sorting.
- **Auth:** Bearer JWT required.
- **Query Params (`TransactionsQueryDto`):**
  - `page` (default: 1)
  - `limit` (default: 10, max: 100)
  - `q` / `search` (searches `txnCode`, `reference`, customer name, customer email)
  - `type` (enum: `PAYMENT`, `REFUND`, `TRANSFER`, optional)
  - `status` (enum: `COMPLETED`, `PENDING`, `FAILED`, `REFUNDED`, optional)
  - `minAmount`, `maxAmount` (decimal numbers, optional)
  - `dateFrom`, `dateTo` (ISO dates, optional)
  - `sortBy` (enum: `createdAt`, `amount`, `txnCode`; default: `createdAt`)
  - `order` (enum: `asc`, `desc`; default: `desc`)
- **Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "e3f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "txnCode": "TXN-0017",
        "reference": "ref_992743055",
        "userId": "d4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "customerName": "Sarah Jenkins",
        "customerEmail": "sarah.jenkins@example.com",
        "customerAvatar": "https://i.pravatar.cc/150?u=1",
        "type": "PAYMENT",
        "status": "COMPLETED",
        "amount": 1250.00,
        "currency": "USD",
        "productName": "iPhone 13 Pro",
        "paymentMethod": "Credit Card (Visa ending in 4582)",
        "gatewayFee": 36.25,
        "subtotal": 1213.75,
        "total": 1250.00,
        "settledAt": "2026-10-04T14:25:00.000Z",
        "createdAt": "2026-10-04T14:20:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 2840,
      "totalPages": 284
    }
  }
  ```

### 5.2. `GET /api/v1/transactions/stats`
- **Purpose:** Overview statistics for transaction history header.
- **Auth:** Bearer JWT required.
- **Response (`200 OK`):**
  ```json
  {
    "total": 2840,
    "revenue": 1148200.00,
    "avg": 404.30,
    "pendingCount": 18,
    "successRate": 96.8
  }
  ```

### 5.3. `GET /api/v1/transactions/:code`
- **Purpose:** Detailed transaction invoice view, customer summary, audit history, and related ledger entries.
- **Auth:** Bearer JWT required.
- **Path Params:** `:code` (txnCode e.g. `TXN-0017` or UUID).
- **Response (`200 OK`):**
  ```json
  {
    "id": "e3f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
    "txnCode": "TXN-0017",
    "reference": "ref_992743055",
    "type": "PAYMENT",
    "status": "COMPLETED",
    "amount": 1250.00,
    "currency": "USD",
    "productName": "iPhone 13 Pro",
    "paymentMethod": "Credit Card (Visa ending in 4582)",
    "gatewayFee": 36.25,
    "subtotal": 1213.75,
    "total": 1250.00,
    "settledAt": "2026-10-04T14:25:00.000Z",
    "createdAt": "2026-10-04T14:20:00.000Z",
    "customer": {
      "id": "d4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
      "userCode": "USR-0001",
      "name": "Sarah Jenkins",
      "email": "sarah.jenkins@example.com",
      "avatarUrl": "https://i.pravatar.cc/150?u=1"
    },
    "statusHistory": [
      {
        "id": "h1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "status": "COMPLETED",
        "note": "Completed & Disbursed to merchant account",
        "createdAt": "2026-10-04T14:25:00.000Z"
      },
      {
        "id": "h2f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "status": "PENDING",
        "note": "Processing & Authorized by Visa Gateway",
        "createdAt": "2026-10-04T14:21:00.000Z"
      },
      {
        "id": "h3f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "status": "PENDING",
        "note": "Checkout session initiated",
        "createdAt": "2026-10-04T14:20:00.000Z"
      }
    ],
    "relatedLedger": [
      {
        "id": "e4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "txnCode": "TXN-0010",
        "paymentMethod": "Credit Card (Visa ending in 4582)",
        "amount": 120.00,
        "status": "COMPLETED",
        "settledAt": "2026-08-15T10:14:00.000Z"
      }
    ]
  }
  ```
- **Errors:** `404 Not Found`.

### 5.4. `POST /api/v1/transactions`
- **Purpose:** Create a new transaction with automatic creation of the initial `TransactionStatusHistory` log.
- **Auth:** Bearer JWT required.
- **Request Body (`CreateTransactionDto`):**
  ```json
  {
    "userId": "d4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
    "type": "PAYMENT",
    "status": "PENDING",
    "amount": 450.00,
    "currency": "USD",
    "productName": "Annual Maintenance Plan",
    "paymentMethod": "Credit Card (Visa ending in 4582)",
    "gatewayFee": 13.05,
    "subtotal": 436.95,
    "total": 450.00
  }
  ```
- **Response (`201 Created`):** Returns created transaction object.
- **Errors:** `400 Bad Request`, `404 Not Found` (Target user does not exist).

### 5.5. `PATCH /api/v1/transactions/:code/status`
- **Purpose:** Update transaction status (e.g. from PENDING to COMPLETED or REFUNDED) and record the transition note in `TransactionStatusHistory`.
- **Auth:** Bearer JWT required.
- **Request Body (`UpdateTransactionStatusDto`):**
  ```json
  {
    "status": "COMPLETED",
    "note": "Settlement confirmed by merchant bank"
  }
  ```
- **Response (`200 OK`):** Returns updated transaction with statusHistory.
- **Errors:** `400 Bad Request`, `404 Not Found`.

---

## 6. Bookings Endpoints

### 6.1. `GET /api/v1/bookings`
- **Purpose:** Paginated list of service bookings with search, filters, and sorting.
- **Auth:** Bearer JWT required.
- **Query Params (`BookingsQueryDto`):**
  - `page` (default: 1)
  - `limit` (default: 10, max: 100)
  - `q` / `search` (searches `bookingCode`, customer name, service name)
  - `status` (enum: `CONFIRMED`, `PENDING`, `COMPLETED`, `CANCELLED`, optional)
  - `when` (enum: `upcoming`, `past`, optional)
  - `category` / `service` (string, optional)
  - `dateFrom`, `dateTo` (ISO dates, optional)
  - `sortBy` (enum: `scheduledAt`, `amount`, `createdAt`; default: `scheduledAt`)
  - `order` (enum: `asc`, `desc`; default: `asc`)
- **Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "b5f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "bookingCode": "BKG-0045",
        "userId": "d4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "customerName": "Sarah Jenkins",
        "customerEmail": "sarah.jenkins@example.com",
        "customerAvatar": "https://i.pravatar.cc/150?u=1",
        "serviceName": "Home Deep Cleaning",
        "category": "Cleaning",
        "scheduledAt": "2026-10-12T10:00:00.000Z",
        "durationHours": 1.5,
        "endTime": "2026-10-12T11:30:00.000Z",
        "location": "Virtual - Zoom Link Provided",
        "status": "CONFIRMED",
        "amount": 149.00,
        "paymentStatus": "PAID",
        "paymentMethod": "Credit Card (Visa ending in 4582)",
        "invoiceCode": "INV-98943",
        "createdAt": "2026-10-01T09:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 480,
      "totalPages": 48
    }
  }
  ```

### 6.2. `GET /api/v1/bookings/stats`
- **Purpose:** Overview statistics for bookings directory cards.
- **Auth:** Bearer JWT required.
- **Response (`200 OK`):**
  ```json
  {
    "total": 480,
    "active": 185,
    "upcoming": 140,
    "completed": 230,
    "cancelled": 65,
    "totalRevenue": 71520.00,
    "totalChangePct": 8.4,
    "activeChangePct": 3.1,
    "completedChangePct": 12.1,
    "cancelledChangePct": 1.4
  }
  ```

### 6.3. `GET /api/v1/bookings/:code`
- **Purpose:** Detailed meeting logistics, customer overview with completed bookings count, payment ledger, and lifecycle audit logs.
- **Auth:** Bearer JWT required.
- **Path Params:** `:code` (bookingCode e.g. `BKG-0045` or UUID).
- **Response (`200 OK`):**
  ```json
  {
    "id": "b5f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
    "bookingCode": "BKG-0045",
    "serviceName": "Home Deep Cleaning",
    "category": "Cleaning",
    "scheduledAt": "2026-10-12T10:00:00.000Z",
    "durationHours": 1.5,
    "endTime": "2026-10-12T11:30:00.000Z",
    "location": "Virtual - Zoom Link Provided",
    "customerNotes": "Need assistance with expanding our payment gateway options and preparing our database backup plans.",
    "status": "CONFIRMED",
    "amount": 149.00,
    "paymentStatus": "PAID",
    "paymentMethod": "Credit Card (Visa ending in 4582)",
    "invoiceCode": "INV-98943",
    "createdAt": "2026-10-01T09:00:00.000Z",
    "customer": {
      "id": "d4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
      "userCode": "USR-0001",
      "name": "Sarah Jenkins",
      "email": "sarah.jenkins@example.com",
      "avatarUrl": "https://i.pravatar.cc/150?u=1",
      "completedBookingsCount": 12
    },
    "lifecycleLogs": [
      {
        "id": "l1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "event": "Confirmation Sent",
        "description": "Outlook invite dispatched to customer",
        "createdAt": "2026-10-01T10:00:00.000Z"
      },
      {
        "id": "l2f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "event": "Status Set to Confirmed",
        "description": "Consultant assigned automatically",
        "createdAt": "2026-10-01T09:30:00.000Z"
      },
      {
        "id": "l3f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
        "event": "Booking Created",
        "description": "Client self-service reservation created",
        "createdAt": "2026-10-01T09:28:00.000Z"
      }
    ]
  }
  ```
- **Errors:** `404 Not Found`.

### 6.4. `POST /api/v1/bookings`
- **Purpose:** Create a new booking appointment.
- **Auth:** Bearer JWT required.
- **Request Body (`CreateBookingDto`):**
  ```json
  {
    "userId": "d4f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
    "serviceName": "Technical Support Consultation",
    "category": "Support",
    "scheduledAt": "2026-10-18T14:00:00.000Z",
    "durationHours": 1.0,
    "location": "Virtual - Google Meet",
    "customerNotes": "Review cloud migration logs",
    "amount": 99.00,
    "paymentMethod": "Credit Card (Visa ending in 4582)"
  }
  ```
- **Response (`201 Created`):** Returns created booking object with initial `BookingLog`.
- **Errors:** `400 Bad Request`, `404 Not Found` (Target user not found).

### 6.5. `PATCH /api/v1/bookings/:code`
- **Purpose:** Update details, reschedule (`scheduledAt`), or cancel (`status: CANCELLED`) an existing booking appointment.
- **Auth:** Bearer JWT required.
- **Request Body (`UpdateBookingDto`):**
  ```json
  {
    "scheduledAt": "2026-10-20T15:00:00.000Z",
    "status": "CONFIRMED",
    "customerNotes": "Rescheduled per client request"
  }
  ```
- **Response (`200 OK`):** Returns updated booking object and appends rescheduling/cancellation entry to `BookingLog`.
- **Errors:** `400 Bad Request`, `404 Not Found`.

---

## 7. Health Check & Diagnostic Probe Endpoints

### 7.1. `GET /health` & `GET /api/v1/health`
- **Purpose:** Basic system heartbeat check for deployment monitors, load balancers, and CI verification.
- **Auth:** Public (no authentication required).
- **Response (`200 OK`):**
  ```json
  {
    "status": "ok",
    "uptime": 1284.52,
    "timestamp": "2026-10-05T20:45:00.000Z"
  }
  ```

### 7.2. `GET /health/live` & `GET /api/v1/health/live`
- **Purpose:** Process liveness probe for Kubernetes and Docker container managers.
- **Auth:** Public.
- **Response (`200 OK`):**
  ```json
  {
    "status": "ok",
    "uptime": 1284.52,
    "timestamp": "2026-10-05T20:45:00.000Z"
  }
  ```

### 7.3. `GET /health/ready` & `GET /api/v1/health/ready`
- **Purpose:** Dependency readiness probe verifying PostgreSQL database connectivity before traffic routing.
- **Auth:** Public.
- **Response (`200 OK`):**
  ```json
  {
    "status": "ok",
    "database": "connected",
    "uptime": 1284.52,
    "timestamp": "2026-10-05T20:45:00.000Z"
  }
  ```
- **Error Response (`503 Service Unavailable`):**
  ```json
  {
    "status": "error",
    "database": "disconnected",
    "uptime": 1284.52,
    "timestamp": "2026-10-05T20:45:00.000Z"
  }
  ```

---

## 8. System Alerts & Notifications Endpoints

### 8.1. `GET /api/v1/alerts`
- **Purpose:** Retrieve paginated list of operational alerts with search and filtering.
- **Auth:** Bearer JWT required.
- **Query Parameters:**
  - `page` (default 1, min 1)
  - `limit` (default 10, min 1, max 100)
  - `search` / `q` (keyword query across title and description)
  - `severity` (`INFO`, `WARNING`, `CRITICAL`)
  - `isResolved` (boolean string `true` or `false`)
  - `sortBy` (`createdAt`, `severity`, `title`)
  - `order` (`asc`, `desc`)
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

### 8.2. `GET /api/v1/alerts/stats`
- **Purpose:** Retrieve aggregate counts of total, active, resolved, critical, warning, and info alerts.
- **Auth:** Bearer JWT required.
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

### 8.3. `GET /api/v1/alerts/notifications-feed`
- **Purpose:** Retrieve notifications dropdown feed and unread badge count for the topbar bell.
- **Auth:** Bearer JWT required.
- **Query Parameters:** `limit` (default 5, max 20)
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

### 8.4. `POST /api/v1/alerts`
- **Purpose:** Create a new administrative system alert.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Request Body:**
  ```json
  {
    "title": "Scheduled DB Maintenance",
    "description": "Database failover drill planned for 02:00 UTC",
    "severity": "INFO"
  }
  ```
- **Response (`201 Created`):** Returns created alert object inside `data` envelope.

### 8.5. `GET /api/v1/alerts/:id`
- **Purpose:** Retrieve single alert details by UUID.
- **Auth:** Bearer JWT required.
- **Response (`200 OK`):** Returns alert object inside `data` envelope.
- **Errors:** `400 Bad Request`, `404 Not Found`.

### 8.6. `PATCH /api/v1/alerts/:id`
- **Purpose:** Update alert title, description, severity, or resolution status.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Response (`200 OK`):** Returns updated alert object inside `data` envelope.

### 8.7. `PATCH /api/v1/alerts/:id/resolve`
- **Purpose:** Mark single alert as resolved.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
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

### 8.8. `PATCH /api/v1/alerts/batch-resolve`
- **Purpose:** Mark multiple alerts as resolved by UUID array.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
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

### 8.9. `PATCH /api/v1/alerts/resolve-all`
- **Purpose:** Mark all active unresolved alerts as resolved.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "resolvedCount": 5,
      "message": "All active alerts marked as resolved"
    }
  }
  ```

### 8.10. `DELETE /api/v1/alerts/:id`
- **Purpose:** Delete alert permanently.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` only).
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "id": "a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
      "message": "Alert deleted successfully"
    }
  }
  ```
- **Errors:** `401 Unauthorized`, `403 Forbidden` (non-SUPER_ADMIN), `404 Not Found`.

---

## 9. Admin Directory & Lifecycle Management Endpoints

### 9.1. `GET /api/v1/admins`
- **Purpose:** Paginated listing of system administrators.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` only).
- **Query Params (`AdminsQueryDto`):**
  - `page` (number, default: 1)
  - `limit` (number, default: 10, max: 100)
  - `role` (enum: `ADMIN`, `SUPER_ADMIN`, optional)
  - `search` (string, optional: searches `name` and `email`)
- **Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "Sarah Jenkins",
        "email": "admin@miles.io",
        "role": "SUPER_ADMIN",
        "avatarUrl": "https://i.pravatar.cc/150?u=admin_sarah",
        "phone": "+1 (555) 014-2210",
        "timezone": "PST (UTC-08:00)",
        "twoFactorEnabled": true,
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-10-06T09:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "totalPages": 1
    }
  }
  ```
- **Errors:** `401 Unauthorized`, `403 Forbidden`.

### 9.2. `GET /api/v1/admins/:id`
- **Purpose:** Retrieve administrator details by UUID.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` only).
- **Response (`200 OK`):** Returns admin object.
- **Errors:** `400 Bad Request` (Invalid UUID), `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

### 9.3. `POST /api/v1/admins`
- **Purpose:** Provision a new administrator account with bcrypt hashed password.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` only).
- **Request Body (`CreateAdminDto`):**
  ```json
  {
    "name": "Michael Chen",
    "email": "michael.chen@miles.io",
    "password": "InitialPassword123!",
    "role": "ADMIN",
    "phone": "+1 (555) 014-8832",
    "timezone": "EST (UTC-05:00)"
  }
  ```
- **Response (`201 Created`):** Returns created admin object.
- **Errors:** `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `409 Conflict` (Email taken).

### 9.4. `PATCH /api/v1/admins/:id/role`
- **Purpose:** Update administrator role (`ADMIN` or `SUPER_ADMIN`).
- **Auth:** Bearer JWT required (`SUPER_ADMIN` only).
- **Safety Invariants:**
  - Cannot change/demote caller's own role.
  - Cannot demote the sole remaining Super Administrator.
- **Request Body (`UpdateAdminRoleDto`):**
  ```json
  {
    "role": "SUPER_ADMIN"
  }
  ```
- **Response (`200 OK`):** Returns updated admin object.
- **Errors:** `400 Bad Request` (Invariant violation), `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

### 9.5. `DELETE /api/v1/admins/:id`
- **Purpose:** Remove administrator account.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` only).
- **Safety Invariants:**
  - Cannot delete caller's own account.
  - Cannot delete the sole remaining Super Administrator.
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "message": "Administrator account deleted successfully"
    }
  }
  ```
- **Errors:** `400 Bad Request` (Invariant violation), `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

---

## 10. Workspace Settings Endpoints

### 10.1. `GET /api/v1/settings`
- **Purpose:** Retrieve system and organization workspace configuration.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "workspaceName": "AdminHub",
      "supportEmail": "support@adminhub.io",
      "currency": "USD",
      "timezone": "PST (UTC-08:00)",
      "updatedAt": "2026-10-06T09:00:00.000Z"
    }
  }
  ```
- **Errors:** `401 Unauthorized`.

### 10.2. `PATCH /api/v1/settings`
- **Purpose:** Update organization workspace configuration.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` only).
- **Request Body (`UpdateSettingsDto`):**
  ```json
  {
    "workspaceName": "AdminHub Enterprise",
    "supportEmail": "ops@adminhub.io",
    "currency": "USD",
    "timezone": "PST (UTC-08:00)"
  }
  ```
- **Response (`200 OK`):** Returns updated workspace settings.
- **Errors:** `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`.

---

## 11. Activities Stream Endpoints

### 11.1. `GET /api/v1/activities`
- **Purpose:** Retrieve paginated system activity and user audit log stream.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Query Params (`ActivitiesQueryDto`):**
  - `page` (number, default: 1)
  - `limit` (number, default: 10, max: 100)
  - `userId` (UUID, optional: filter by user)
  - `action` (string, optional: filter by action name)
  - `search` (string, optional: searches action and description)
  - `startDate` (ISO 8601 string, optional)
  - `endDate` (ISO 8601 string, optional)
- **Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "userId": "123e4567-e89b-12d3-a456-426614174111",
        "action": "Profile Updated",
        "description": "Primary contact phone and billing address confirmed",
        "createdAt": "2026-10-01T14:30:00.000Z",
        "user": {
          "id": "123e4567-e89b-12d3-a456-426614174111",
          "userCode": "USR-0001",
          "name": "Sarah Jenkins",
          "email": "sarah.jenkins@example.com"
        }
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5
    }
  }
  ```
- **Errors:** `401 Unauthorized`.

---

## 12. Enterprise Bulk Operations Endpoints

### 12.1. `POST /api/v1/users/bulk/status`
- **Purpose:** Batch update user statuses with atomic transactional audit logging.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Request Body (`BulkUserStatusDto`):**
  ```json
  {
    "userCodes": ["USR-0001", "USR-0002"],
    "status": "SUSPENDED"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "success": true,
      "affectedCount": 2,
      "affectedCodes": ["USR-0001", "USR-0002"],
      "message": "Successfully updated status to SUSPENDED for 2 user(s)"
    }
  }
  ```
- **Errors:** `400 Bad Request` (empty array, invalid status), `401 Unauthorized`.

### 12.2. `POST /api/v1/users/bulk/role`
- **Purpose:** Batch update customer user roles with atomic audit logging.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` only).
- **Request Body (`BulkUserRoleDto`):**
  ```json
  {
    "userCodes": ["USR-0001", "USR-0002"],
    "role": "EDITOR"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "success": true,
      "affectedCount": 2,
      "affectedCodes": ["USR-0001", "USR-0002"],
      "message": "Successfully updated role to EDITOR for 2 user(s)"
    }
  }
  ```
- **Errors:** `400 Bad Request`, `401 Unauthorized`, `403 Forbidden` (for non-SUPER_ADMIN).

### 12.3. `POST /api/v1/users/bulk/delete`
- **Purpose:** Batch soft-delete users, marking them inactive and recording audit timestamps.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` only).
- **Request Body (`BulkUserDeleteDto`):**
  ```json
  {
    "userCodes": ["USR-0001", "USR-0002"]
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "success": true,
      "affectedCount": 2,
      "affectedCodes": ["USR-0001", "USR-0002"],
      "message": "Successfully soft deleted 2 user(s)"
    }
  }
  ```
- **Errors:** `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`.

---

## 13. Data Export Endpoints (RFC 4180 CSV)

All export endpoints generate standard RFC 4180 CSV streams with UTF-8 BOM encoding for seamless Microsoft Excel rendering. They include CSV formula injection mitigation (`=`, `+`, `-`, `@` escaping) and bypass JSON envelope transformation via `@BypassResponseTransform()`.

### 13.1. `GET /api/v1/users/export`
- **Purpose:** Export filtered customer directory to CSV.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Query Params:** Supports all `UsersQueryDto` filters (`role`, `status`, `q`, `search`).
- **Response Header:** `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="users_export_YYYY-MM-DD.csv"`.

### 13.2. `GET /api/v1/transactions/export`
- **Purpose:** Export filtered financial transaction ledger to CSV.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Query Params:** Supports all `TransactionsQueryDto` filters (`status`, `type`, `date`, `dateFrom`, `dateTo`, `search`).
- **Response Header:** `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="transactions_export_YYYY-MM-DD.csv"`.

### 13.3. `GET /api/v1/bookings/export`
- **Purpose:** Export filtered appointments directory to CSV.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Query Params:** Supports all `BookingsQueryDto` filters (`status`, `category`, `when`, `dateFrom`, `dateTo`, `search`).
- **Response Header:** `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="bookings_export_YYYY-MM-DD.csv"`.

### 13.4. `GET /api/v1/dashboard/reports/export`
- **Purpose:** Export 12-month financial and order performance table with summary totals to CSV.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Response Header:** `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="monthly_reports_export_YYYY-MM-DD.csv"`.

---

## 14. Direct Lifecycle Action Endpoints

### 14.1. `POST /api/v1/transactions/:id/refund`
- **Purpose:** Process refund on an eligible payment transaction and generate audit history.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Request Body (`RefundTransactionDto`):**
  ```json
  {
    "reason": "Customer cancellation request"
  }
  ```
- **Response (`200 OK`):** Returns full `TransactionDetailResponseDto` with updated `status: "REFUNDED"`.
- **Errors:** `400 Bad Request` (already refunded, failed transaction), `401 Unauthorized`, `404 Not Found`.

### 14.2. `POST /api/v1/bookings/:id/reschedule`
- **Purpose:** Reschedule an appointment to a new future time window with overlapping conflict prevention.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Request Body (`RescheduleBookingDto`):**
  ```json
  {
    "scheduledAt": "2026-10-25T14:00:00.000Z",
    "note": "Client requested afternoon slot"
  }
  ```
- **Response (`200 OK`):** Returns updated `BookingDetailResponseDto` with recalculated `endTime`.
- **Errors:** `400 Bad Request` (past timestamp, cancelled/completed booking), `401 Unauthorized`, `409 Conflict` (collision).

### 14.3. `POST /api/v1/bookings/:id/cancel`
- **Purpose:** Cancel an existing appointment with reason recording and audit history.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Request Body (`CancelBookingDto`):**
  ```json
  {
    "reason": "Weather conditions prevented site access"
  }
  ```
- **Response (`200 OK`):** Returns updated `BookingDetailResponseDto` with `status: "CANCELLED"`.
- **Errors:** `400 Bad Request` (already cancelled, completed booking), `401 Unauthorized`, `404 Not Found`.

---

## 15. Cross-Entity Omni-Search Endpoint

### 15.1. `GET /api/v1/search`
- **Purpose:** Unified global cross-entity search across Users, Transactions, and Bookings for command palettes and omni-search boxes.
- **Auth:** Bearer JWT required (`SUPER_ADMIN` or `ADMIN`).
- **Query Params (`SearchQueryDto`):**
  - `q` (string, required, min 1 character, max 100 characters): Search term
  - `limit` (number, optional, default: 5, max: 20): Results per entity category
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "query": "Sarah",
      "totalMatches": 10,
      "users": [
        {
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "userCode": "USR-0001",
          "name": "Sarah Jenkins",
          "email": "sarah.jenkins@example.com",
          "role": "ADMIN",
          "status": "ACTIVE"
        }
      ],
      "transactions": [
        {
          "id": "223e4567-e89b-12d3-a456-426614174000",
          "txnCode": "TXN-0017",
          "customerName": "Sarah Jenkins",
          "amount": 1250.0,
          "status": "COMPLETED",
          "type": "PAYMENT"
        }
      ],
      "bookings": [
        {
          "id": "323e4567-e89b-12d3-a456-426614174000",
          "bookingCode": "BKG-0045",
          "customerName": "Sarah Jenkins",
          "serviceName": "Home Deep Cleaning",
          "scheduledAt": "2026-10-12T10:00:00.000Z",
          "status": "CONFIRMED"
        }
      ]
    }
  }
  ```
- **Errors:** `400 Bad Request` (missing or empty `q`), `401 Unauthorized`.


