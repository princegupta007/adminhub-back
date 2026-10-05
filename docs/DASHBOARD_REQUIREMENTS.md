# Dashboard Requirements & Calculation Specifications

This document defines every KPI, statistical metric, chart, grouping, time window, alert, and activity item rendered on the AdminHub dashboard. All values are calculated server-side from PostgreSQL.

---

## 1. UI Elements & Calculation Matrix

| UI Element | Backend Source | Calculation | API |
|---|---|---|---|
| **KPI: Total Users** | `User` table | Total count of active accounts (`deletedAt IS NULL`). MoM % change = `((currentMonthUsers - prevMonthUsers) / prevMonthUsers) * 100`. | `GET /api/v1/dashboard/stats` |
| **KPI: Total Revenue** | `Transaction` table | Sum of `amount` where `status = 'COMPLETED'`. MoM % change = `((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100`. | `GET /api/v1/dashboard/stats` |
| **KPI: Active Bookings** | `Booking` table | Count of bookings with `status IN ('CONFIRMED', 'PENDING')`. MoM % change = `((currentMonthActive - prevMonthActive) / prevMonthActive) * 100`. | `GET /api/v1/dashboard/stats` |
| **KPI: Pending Transactions** | `Transaction` table | Count of transactions with `status = 'PENDING'`. MoM % change = `((currentMonthPending - prevMonthPending) / prevMonthPending) * 100`. | `GET /api/v1/dashboard/stats` |
| **Dashboard Totals: Pending Revenue** | `Transaction` table | Sum of `amount` where `status = 'PENDING'`. | `GET /api/v1/dashboard/stats` |
| **Dashboard Totals: Order Counts by Status** | `Transaction` table | Discrete counts: `paidOrders` (`COMPLETED`), `pendingOrders` (`PENDING`), `failedOrders` (`FAILED`), `refundedOrders` (`REFUNDED`). | `GET /api/v1/dashboard/stats` |
| **Dashboard Totals: Average Order Value (AOV)** | `Transaction` table | `sum(amount where status = 'COMPLETED') / count(status = 'COMPLETED')`. | `GET /api/v1/dashboard/stats` |
| **Dashboard Totals: Booking Success Rate** | `Booking` table | `(count(status != 'CANCELLED') / count(*)) * 100`. | `GET /api/v1/dashboard/stats` |
| **Revenue Overview Chart (Time-Series Area/Bar)** | `Transaction` table (`status = 'COMPLETED'`) | Grouped by time bucket (day for `7d`, month for `1m`, `3m`, `6m`, `1y`). For each bucket: `revenue` (`sum(amount)`), `orders` (`count(*)`). | `GET /api/v1/dashboard/charts?range=...` |
| **Orders by Status Donut Chart** | `Transaction` table | Grouped by `status`. For each status: `label`, `count` (`count(*)`), `amount` (`sum(amount)`). Total center value: `count(*)`. | `GET /api/v1/dashboard/charts` |
| **Bookings by Category Bar Chart** | `Booking` table | Grouped by `category` (excluding `CANCELLED`). For each category: `bookings` (`count(*)`), `revenue` (`sum(amount)`). Top 6 categories sorted by bookings desc. | `GET /api/v1/dashboard/charts` |
| **Booking Status Breakdown Bar Chart** | `Booking` table | Grouped by `status` (`CONFIRMED`, `PENDING`, `COMPLETED`, `CANCELLED`). For each slice: `label`, `bookings` (`count(*)`), `revenue` (`sum(amount)`). | `GET /api/v1/dashboard/charts` |
| **Top Products Table** | `Transaction` table | Grouped by `productName` (excluding `FAILED`). For each product: `title`, `thumbnail`, `unitsSold` (`count(*)`), `revenue` (`sum(amount)`). Top 5 by revenue. | `GET /api/v1/dashboard/charts` |
| **Monthly Reports Table** | `Transaction` table | 12 calendar month historical breakdown. For each month: `month` (e.g. "Oct 2026"), `orders` (`count(*)`), `revenue` (`sum(amount)`), `avgPerOrder` (`revenue / orders`). Bottom row: totals. | `GET /api/v1/dashboard/charts?range=1y` |
| **System Alerts Widget** | `Alert` table | Active system alerts (`isResolved = false`) sorted by `createdAt DESC`. Fields: `id`, `title`, `description`, `severity` (`INFO`, `WARNING`, `CRITICAL`), `time`. | `GET /api/v1/dashboard/alerts` |
| **System Health Widget** | Server / Runtime / DB | Infrastructure health: `uptime` (percentage / process uptime), `avgResponseTime` (ms), `activeSessions` (count), `status` ("ok"). | `GET /api/v1/dashboard/health` |
| **Recent Transactions Table** | `Transaction` JOIN `User` | Top N (default 6) transactions sorted by `createdAt DESC`. Columns: txnCode, customerName, customerEmail, customerAvatar, type, amount, status, paymentMethod, createdAt. | `GET /api/v1/dashboard/recent-transactions?limit=6` |

---

## 2. Time Window & Aggregation Specifications

### 2.1. Month-over-Month (MoM) Percentage Calculations
For all KPI summary cards:
- **Current Calendar Month Window:** First moment of current month to current timestamp (`>= 2026-10-01 00:00:00` and `<= now`).
- **Previous Calendar Month Window:** First moment of previous month to end of previous month (`>= 2026-09-01 00:00:00` and `< 2026-10-01 00:00:00`).
- **Formula:**
  $$\text{ChangePct} = \begin{cases} \left(\frac{\text{Current} - \text{Previous}}{\text{Previous}}\right) \times 100 & \text{if } \text{Previous} > 0 \\ 0.0 & \text{if } \text{Previous} = 0 \end{cases}$$
- **Trend Assignment:**
  - `up`: $\text{ChangePct} > 0$
  - `down`: $\text{ChangePct} < 0$
  - `flat`: $\text{ChangePct} == 0$

### 2.2. Chart Time Range Buckets (`?range=`)

| Range Parameter | Duration Covered | Aggregation Interval | Total Data Points | Output Bucket Format |
|---|---|---|---|---|
| `7d` | Last 7 days | Daily | 7 points | Short day (e.g., "Mon", "Tue", "Oct 05") |
| `1m` | Last 30 days | Daily / Weekly | 30 points (or 4 weekly) | Day of month (e.g., "Sep 15", "Sep 22") |
| `3m` | Last 90 days | Monthly | 3 points | Month abbreviation (e.g., "Aug", "Sep", "Oct") |
| `6m` (default) | Last 6 calendar months | Monthly | 6 points | Month abbreviation (e.g., "May", "Jun", "Jul", "Aug", "Sep", "Oct") |
| `1y` | Last 12 calendar months | Monthly | 12 points | Month & Year (e.g., "Nov 2025", ..., "Oct 2026") |

*Note:* Zero-filling ensures that periods with zero transactions still appear in the series with `revenue: 0.00` and `orders: 0`, preventing truncated or distorted line charts.
