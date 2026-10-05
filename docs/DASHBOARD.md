# Dashboard Module Documentation

## 1. Overview
The **Dashboard Module** (`src/dashboard`) serves as the central operational intelligence hub for the Miles Admin Hub platform. It calculates and serves real-time platform metrics, KPIs with 30-day relative change percentages and trend indicators, continuous zero-filled time-series chart distributions, operational alerts, infrastructure health metrics, and unified overview payloads.

It directly powers:
- The **Admin Overview Dashboard** (Figma / `miles-flax.vercel.app` home screen).
- The **Analytics Tab** (Status distributions, Category volumes, Top products).
- The **Reports Tab** (12-month historical order and revenue ledger).
- The **System Alerts Drawer & Widget**.
- The **Infrastructure Health Monitor**.

---

## 2. Architecture & Design Principles

```
                    HTTP Request (Bearer JWT)
                                │
                                ▼
         DashboardController (`/api/v1/dashboard`)
                                │
     ┌──────────────┬───────────┴───────────┬──────────────┐
     │              │                       │              │
     ▼              ▼                       ▼              ▼
   /stats        /charts                 /alerts        /health
     │              │                       │              │
     └──────────────┼───────────────────────┼──────────────┘
                    ▼                       ▼
            DashboardService ───► PostgreSQL / Prisma ORM
                                    ├── `User`
                                    ├── `Transaction`
                                    ├── `Booking`
                                    └── `Alert`
```

### Key Technical Invariants
1. **Decimal Precision**: All revenue and monetary totals use PostgreSQL `DECIMAL(12, 2)` mapped through `Prisma.Decimal` and `toDecimalNumber()`. Floating-point drift is strictly eliminated.
2. **Zero-Filled Time Series**: Chart intervals (`7d`, `1m`, `3m`, `6m`, `1y`) generate continuous date buckets with revenue and order counts zero-filled, preventing broken or distorted frontend line/area charts.
3. **MoM / 30-Day Trend Calculus**:
   - Compares the last 30 days against the preceding 30-day window ($[-60\text{d}, -30\text{d}]$).
   - Trend direction assigned as `up` ($> 0.05\%$), `down` ($< -0.05\%$), or `flat` ($\le |0.05\%|$).
4. **Resilient System Health Monitoring**: Node process uptime, database connection latency, and active registered sessions calculated in real-time.

---

## 3. Endpoints & API Contract

Base URL: `/api/v1/dashboard`  
Security: `Authorization: Bearer <JWT>`

### 3.1. `GET /api/v1/dashboard/stats`
- **Description**: Returns 4 core KPI cards and aggregated system totals.
- **Response (`200 OK`)**:
```json
{
  "statusCode": 200,
  "data": {
    "kpis": [
      {
        "id": "users",
        "label": "Total Users",
        "value": 1420,
        "format": "number",
        "changePct": 12.5,
        "trend": "up",
        "hint": "vs previous 30 days"
      },
      {
        "id": "revenue",
        "label": "Total Revenue",
        "value": 482500.0,
        "format": "fullCurrency",
        "changePct": 8.3,
        "trend": "up",
        "hint": "vs previous 30 days"
      },
      {
        "id": "bookings",
        "label": "Active Bookings",
        "value": 310,
        "format": "number",
        "changePct": -2.4,
        "trend": "down",
        "hint": "vs previous 30 days"
      },
      {
        "id": "pending",
        "label": "Pending Transactions",
        "value": 18,
        "format": "number",
        "changePct": 5.0,
        "trend": "up",
        "hint": "vs previous 30 days"
      }
    ],
    "totals": {
      "revenue": 482500.0,
      "pendingRevenue": 14200.0,
      "orders": 1240,
      "paidOrders": 1180,
      "pendingOrders": 18,
      "failedOrders": 42,
      "users": 1420,
      "bookings": 480,
      "confirmedBookings": 210,
      "completedBookings": 230,
      "averageOrderValue": 408.9,
      "bookingSuccessRate": 91.67
    }
  }
}
```

---

### 3.2. `GET /api/v1/dashboard/charts`
- **Query Parameters**:
  - `range`: `7d` | `1m` | `3m` | `6m` | `1y` (default: `6m`)
- **Response (`200 OK`)**:
```json
{
  "statusCode": 200,
  "data": {
    "range": "6m",
    "revenueByPeriod": [
      { "period": "May 2026", "month": "May", "revenue": 68400.0, "orders": 185 },
      { "period": "Oct 2026", "month": "Oct", "revenue": 80000.0, "orders": 188 }
    ],
    "revenueByMonth": [ /* Alias matching frontend */ ],
    "ordersByStatus": [
      { "status": "COMPLETED", "label": "Paid", "count": 1180, "amount": 482500.0 },
      { "status": "PENDING", "label": "Pending", "count": 18, "amount": 14200.0 },
      { "status": "FAILED", "label": "Failed", "count": 42, "amount": 16500.0 },
      { "status": "REFUNDED", "label": "Refunded", "count": 12, "amount": -4800.0 }
    ],
    "bookingsByStatus": [
      { "status": "CONFIRMED", "label": "Confirmed", "count": 140, "amount": 28500.0 },
      { "status": "PENDING", "label": "Pending", "count": 45, "amount": 9200.0 },
      { "status": "COMPLETED", "label": "Completed", "count": 230, "amount": 46000.0 },
      { "status": "CANCELLED", "label": "Cancelled", "count": 65, "amount": 12800.0 }
    ],
    "bookingsByCategory": [
      { "category": "Cleaning", "bookings": 160, "revenue": 24000.0 },
      { "category": "Appliances", "bookings": 95, "revenue": 18500.0 }
    ],
    "topProducts": [
      {
        "title": "iPhone 13 Pro",
        "thumbnail": "https://...",
        "unitsSold": 142,
        "revenue": 141858.0
      }
    ]
  }
}
```

---

### 3.3. `GET /api/v1/dashboard/alerts` & `PATCH /api/v1/dashboard/alerts/:id/resolve`
- **GET /alerts**: Returns list of active unresolved operational alerts.
- **PATCH /alerts/:id/resolve**: Marks alert as resolved (`isResolved: true`).
```json
{
  "statusCode": 200,
  "data": {
    "id": "a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b",
    "isResolved": true,
    "message": "Alert marked as resolved"
  }
}
```

---

### 3.4. `GET /api/v1/dashboard/health`
- **Response (`200 OK`)**:
```json
{
  "statusCode": 200,
  "data": {
    "uptime": "99.8%",
    "avgResponseTime": "142ms",
    "activeSessions": 3241,
    "database": "connected",
    "timestamp": "2026-10-06T00:00:00.000Z"
  }
}
```

---

### 3.5. `GET /api/v1/dashboard/recent-transactions` & `GET /api/v1/dashboard/upcoming-bookings`
- **Query Parameters**: `limit` (number, default: 6/5, max: 20)
- **Response**: Array of recent transactions or upcoming bookings enriched with customer details.

---

### 3.6. `GET /api/v1/dashboard/overview`
- **Description**: Unified endpoint delivering all dashboard widgets (`stats`, `charts`, `alerts`, `health`, `recentTransactions`, `upcomingBookings`) in a single network roundtrip.

---

## 4. Testing & Verification
- **Unit Tests (`src/dashboard/dashboard.service.spec.ts`)**: 9 test cases verifying calculations, precision, time-series bucketing, alert resolutions, health checks, and profile mappings.
- **E2E Tests (`test/dashboard.e2e-spec.ts`)**: 18 test cases validating real database execution, Bearer JWT authentication enforcement, query parameters, uuid validations, and full payload integrity.
