# Phase 7 Pre-Flight Gap Audit: Dashboard Module

## 1. Context & Objectives
This audit evaluates the architectural readiness, requirements coverage, and data structures required for implementing **Phase 7: Dashboard Module** in the Miles Admin Hub API backend (`E:\projects\adminhub_back`).

---

## 2. Source Alignment
- **Figma Design**:
  - Primary Admin Dashboard with 4 top KPI cards (Total Users, Total Revenue, Active Bookings, Pending Transactions).
  - Time-series Revenue Overview chart with period selector (`7d`, `1m`, `3m`, `6m`, `1y`).
  - System Alerts list with severity tones (danger, warning, info).
  - System Health widget (Uptime, Avg Response Time, Active Sessions).
  - Recent Transactions table.
  - Analytics tab: Orders by Status donut chart, Bookings by Category bar chart, Top Products table, Booking Status Breakdown chart.
  - Reports tab: 12-month historical breakdown table with monthly orders, revenue, and average per order.
- **Frontend Source (`E:\projects\adminhub`)**:
  - `E:\projects\adminhub\src\features\dashboard\types.ts`
  - `E:\projects\adminhub\src\features\dashboard\stats.ts`
  - `E:\projects\adminhub\src\features\dashboard\components\dashboard-view.tsx`
- **Backend API Contract**:
  - `docs/API_CONTRACT.md` (Section 3: Dashboard Endpoints)
  - `docs/DASHBOARD_REQUIREMENTS.md`

---

## 3. Discovered Gap Analysis & Technical Strategy

| Item | Requirement | Status | Strategy |
|---|---|---|---|
| **KPI Cards** | Users, Revenue, Bookings, Pending with values, changePct, trend, hint | Needs implementation | Calculate in PostgreSQL using 30-day / MoM windows; use Decimal summation for revenue. |
| **Totals Object** | Revenue, pending revenue, order status counts, AOV, success rate | Needs implementation | Aggregate counts and sums across Transaction and Booking models in a single service method. |
| **Time-Series Charts** | Revenue and orders grouped by interval (`7d`, `1m`, `3m`, `6m`, `1y`) | Needs implementation | Generate continuous time buckets with zero-filling to prevent truncated lines in charts. |
| **Categorical Breakdowns** | Orders by status, bookings by status, bookings by category, top products | Needs implementation | Efficient `groupBy` queries or indexed aggregations matching frontend models. |
| **System Alerts** | Active alerts (`isResolved: false`), severity badges, resolve endpoint | Needs implementation | Query `Alert` model ordered by `createdAt DESC`; provide `PATCH /api/v1/dashboard/alerts/:id/resolve`. |
| **System Health** | Server uptime, response time, active sessions, db status | Needs implementation | Derive from Node.js process uptime, active database connection check, and user count. |
| **Recent Transactions** | Top N transactions with customer details | Needs implementation | Query `Transaction` with `include: { user: true }`, limit 6-20. |
| **Unified Overview** | All-in-one `/api/v1/dashboard/overview` | Enhancement | Combines stats, charts, alerts, health, and recent data in a single roundtrip. |

---

## 4. Invariant & Precision Requirements
1. **Financial Precision**: All currency calculations use `Prisma.Decimal` and `toDecimalNumber()`, avoiding IEEE 754 floating point arithmetic.
2. **MoM Percentage Calculations**:
   $$\text{changePct} = \begin{cases} \left(\frac{\text{current} - \text{prev}}{\text{prev}}\right) \times 100 & \text{if } \text{prev} > 0 \\ 0.0 & \text{otherwise} \end{cases}$$
3. **Trend Classification**:
   - `up`: $\text{changePct} > 0.05$
   - `down`: $\text{changePct} < -0.05$
   - `flat`: $|\text{changePct}| \le 0.05$ or null
4. **Zero-Filling**: Every time bucket in the requested chart range must be populated, even if count/revenue is 0.
