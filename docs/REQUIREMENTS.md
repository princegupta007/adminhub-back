# Backend Requirements

> **Project:** Miles Admin Hub API (Admin Hub Backend)  
> **Backend Repository:** `E:\projects\adminhub_back`  
> **Frontend Repository:** `E:\projects\adminhub`  
> **Deployed Frontend Reference:** https://miles-flax.vercel.app/  
> **Figma Reference:** https://www.figma.com/community/file/1687046333054375145  
> **Primary Authority:** Figma & Assignment Specifications; Secondary Authority: Existing Frontend Implementation.

---

## 1. Modules

| Module | Required | Source | Evidence |
|---|---|---|---|
| **Authentication & Authorization** | Yes | Assignment, Figma, Frontend | Login screen (`/login`), Admin profile (`/profile`), JWT auth guard, role-based protection, seeded super admin (`admin@miles.io`). |
| **Dashboard** | Yes | Figma, Frontend, Assignment | Landing screen (`/`), KPI summary cards (Users, Revenue, Bookings, Pending), Revenue area chart, System Alerts, System Health, Recent Transactions, Status Donut, Category Bar Chart. |
| **Users** | Yes | Figma, Frontend, Assignment | Users table (`/users`), search, filter by role/status, sorting, pagination, user details (`/users/[id]`), account stats, recent transactions, recent bookings, recent activity timeline, soft deletion. |
| **Transactions** | Yes | Figma, Frontend, Assignment | Financial transactions ledger (`/transactions`), stats row, search, filters by type/status/date, sorting, pagination, invoice details (`/transactions/[id]`), processing history audit trail, related user ledger. |
| **Bookings** | Yes | Figma, Frontend, Assignment | Bookings directory (`/bookings`), KPI stat cards, search, status/service filter, sorting, pagination, meeting logistics details (`/bookings/[id]`), lifecycle audit logs, reschedule/cancel status transitions. |
| **Health** | Yes | Assignment, Technical | Public health check (`GET /health` and `GET /api/v1/health`) for load balancers and deployment verification. |

---

## 2. Screens

| Screen | Frontend Route | Backend Module | Required Data |
|---|---|---|---|
| **Login Screen** | `/login` | Auth | Email, password credentials verification; returns JWT bearer token, expiration, and authenticated admin profile. |
| **Admin Profile Screen** | `/profile` | Auth | Authenticated admin details: ID, full name, email, role (`SUPER_ADMIN`/`ADMIN`), avatar URL, contact info, timezone, 2FA status, last login timestamp. |
| **Overview Dashboard** | `/` (`tab=overview`) | Dashboard | 4 KPI Cards (Total Users, Total Revenue, Active Bookings, Pending Transactions with MoM % delta); Revenue Chart points (7d/1m/3m/6m/1y); System Alerts list; System Health metrics (uptime, response time, sessions); Recent Transactions (top 5-6). |
| **Analytics Dashboard** | `/` (`tab=analytics`) | Dashboard | Orders by Status breakdown (paid, pending, failed, refunded); Bookings by Category breakdown; Top Products/Services by volume and revenue; Booking Status breakdown. |
| **Reports Dashboard** | `/` (`tab=reports`) | Dashboard | Monthly order count, revenue volume, and average order value breakdown across 12 calendar months with totals row. |
| **Users Directory** | `/users` | Users | User directory list with pagination (`page`, `limit`), search query (`q`), filter (`role`, `status`), sorting (`sortField`, `sortDirection`), user stats summary (Total, Active, New This Month). |
| **User Details** | `/users/[id]` | Users | User identity & profile; account metadata (UserCode `#USR-XXXX`, 2FA status, last login); last 5 transactions; last 5 bookings; last 5 activity timeline events. |
| **Transactions History** | `/transactions` | Transactions | Transactions ledger with pagination, search (`q`), filter (`type`, `status`, `dateRange`), sorting (`date`, `amount`), stats cards (Total Txns, Total Volume, Avg Txn, Success Rate). |
| **Transaction Details** | `/transactions/[id]` | Transactions | Invoice details (`txnCode`, `reference`, subtotal, gateway fee, grand total, payment method); customer summary; Processing History audit trail; Related customer ledger entries. |
| **Bookings Directory** | `/bookings` | Bookings | Bookings ledger with pagination, search, filter (`status`, `service`, `when`), date range, stats cards (Total, Active, Completed, Cancelled with % changes). |
| **Booking Details** | `/bookings/[id]` | Bookings | Meeting logistics (service, scheduled date/time, duration, location, client notes); Customer overview (with total completed bookings counter); Payment ledger breakdown (invoice code, billing amount, status); Lifecycle audit logs. |

---

## 3. Entities

### 3.1. Admin
Represents internal administrators who access the dashboard.

| Entity | Field | Type | Required | Nullable | Source | Notes |
|---|---|---|---|---|---|---|
| Admin | `id` | UUID | Yes | No | Assignment | Primary key |
| Admin | `name` | String (100) | Yes | No | Assignment, Figma | Admin full name (e.g. "Sarah Jenkins") |
| Admin | `email` | String (255) | Yes | No | Assignment | Unique, login identifier (`admin@miles.io`) |
| Admin | `passwordHash` | String (255) | Yes | No | Assignment, Technical | Bcrypt hash (10 rounds). Never returned in API responses. |
| Admin | `role` | Enum (`SUPER_ADMIN`, `ADMIN`) | Yes | No | Assignment, Figma | Administrative access level |
| Admin | `avatarUrl` | String (500) | No | Yes | Figma, Frontend | Profile photo URL |
| Admin | `phone` | String (50) | No | Yes | Frontend | Profile contact phone |
| Admin | `timezone` | String (50) | No | Yes | Frontend | Display timezone (e.g. "PST (UTC-08:00)") |
| Admin | `twoFactorEnabled` | Boolean | Yes | No | Frontend | 2FA security status flag (defaults to true) |
| Admin | `createdAt` | DateTime | Yes | No | Technical | Timestamp of creation |
| Admin | `updatedAt` | DateTime | Yes | No | Technical | Timestamp of last update |

### 3.2. User (App Customers)
Represents registered customers whose accounts, transactions, and bookings are managed.

| Entity | Field | Type | Required | Nullable | Source | Notes |
|---|---|---|---|---|---|---|
| User | `id` | UUID | Yes | No | Assignment | Internal primary key |
| User | `userCode` | String (20) | Yes | No | Assignment, Figma | Human-readable identifier (e.g. "USR-0001"), unique |
| User | `firstName` | String (100) | Yes | No | Assignment, Frontend | First name |
| User | `lastName` | String (100) | Yes | No | Assignment, Frontend | Last name (combined as `name` in API responses) |
| User | `email` | String (255) | Yes | No | Assignment, Frontend | Customer email, unique |
| User | `phone` | String (50) | Yes | No | Assignment, Frontend | Contact phone number |
| User | `dateOfBirth` | Date / String | No | Yes | Assignment, Frontend | Customer date of birth (ISO YYYY-MM-DD) |
| User | `addressLine` | String (255) | No | Yes | Assignment, Frontend | Street address |
| User | `city` | String (100) | No | Yes | Frontend | City |
| User | `state` | String (100) | No | Yes | Frontend | State / Province |
| User | `country` | String (100) | No | Yes | Frontend | Country |
| User | `avatarUrl` | String (500) | No | Yes | Assignment, Figma | Avatar image URL |
| User | `role` | Enum (`ADMIN`, `EDITOR`, `VIEWER`) | Yes | No | Assignment, Frontend | Customer app role |
| User | `status` | Enum (`ACTIVE`, `INACTIVE`, `SUSPENDED`) | Yes | No | Assignment, Frontend | Customer account status |
| User | `twoFactorEnabled` | Boolean | Yes | No | Assignment, Frontend | Whether 2FA is active (defaults to false) |
| User | `lastLoginAt` | DateTime | No | Yes | Assignment, Frontend | Last login / activity timestamp |
| User | `joinedAt` | DateTime | Yes | No | Assignment, Frontend | Registration date (for MoM calculations) |
| User | `createdAt` | DateTime | Yes | No | Technical | Creation timestamp |
| User | `updatedAt` | DateTime | Yes | No | Technical | Update timestamp |
| User | `deletedAt` | DateTime | No | Yes | Assignment, Technical | Soft delete timestamp; null for active records |

### 3.3. Transaction
Represents financial payments, refunds, and balance transfers.

| Entity | Field | Type | Required | Nullable | Source | Notes |
|---|---|---|---|---|---|---|
| Transaction | `id` | UUID | Yes | No | Assignment | Internal primary key |
| Transaction | `txnCode` | String (30) | Yes | No | Assignment, Figma | Unique code (e.g. "TXN-0017") |
| Transaction | `reference` | String (50) | Yes | No | Assignment, Figma | Gateway reference (e.g. "ref_992743055"), unique |
| Transaction | `userId` | UUID | Yes | No | Assignment, Frontend | Foreign key to `User.id` |
| Transaction | `type` | Enum (`PAYMENT`, `REFUND`, `TRANSFER`) | Yes | No | Assignment, Frontend | Financial transaction category |
| Transaction | `status` | Enum (`COMPLETED`, `PENDING`, `FAILED`, `REFUNDED`) | Yes | No | Assignment, Frontend | Processing status |
| Transaction | `amount` | Decimal(12, 2) | Yes | No | Assignment, Frontend | Signed total (refunds are stored as negative) |
| Transaction | `currency` | String (3) | Yes | No | Assignment, Frontend | Standard currency (defaults to "USD") |
| Transaction | `productName` | String (255) | Yes | No | Assignment, Frontend | Primary product/service description (e.g. "iPhone 13 Pro") |
| Transaction | `paymentMethod` | String (100) | Yes | No | Assignment, Frontend | Method description (e.g. "Credit Card (Visa ending in 4582)") |
| Transaction | `gatewayFee` | Decimal(12, 2) | Yes | No | Assignment, Figma | Processing gateway fee |
| Transaction | `subtotal` | Decimal(12, 2) | Yes | No | Assignment, Figma | Amount before fees/discounts |
| Transaction | `total` | Decimal(12, 2) | Yes | No | Assignment, Figma | Gross total |
| Transaction | `settledAt` | DateTime | No | Yes | Assignment, Figma | Settlement timestamp in merchant account |
| Transaction | `createdAt` | DateTime | Yes | No | Technical | Creation timestamp |
| Transaction | `updatedAt` | DateTime | Yes | No | Technical | Update timestamp |

### 3.4. TransactionStatusHistory
Audit timeline for transaction state transitions (powers "Processing History").

| Entity | Field | Type | Required | Nullable | Source | Notes |
|---|---|---|---|---|---|---|
| TransactionStatusHistory | `id` | UUID | Yes | No | Assignment | Primary key |
| TransactionStatusHistory | `transactionId` | UUID | Yes | No | Assignment | Foreign key to `Transaction.id` |
| TransactionStatusHistory | `status` | Enum (`COMPLETED`, `PENDING`, `FAILED`, `REFUNDED`) | Yes | No | Assignment, Figma | Status at that event |
| TransactionStatusHistory | `note` | String (500) | Yes | No | Assignment, Figma | Event description (e.g. "Visa Gateway auth approved") |
| TransactionStatusHistory | `createdAt` | DateTime | Yes | No | Assignment, Technical | Timestamp of the event |

### 3.5. Booking
Represents service appointments and consultation meetings.

| Entity | Field | Type | Required | Nullable | Source | Notes |
|---|---|---|---|---|---|---|
| Booking | `id` | UUID | Yes | No | Assignment | Internal primary key |
| Booking | `bookingCode` | String (30) | Yes | No | Assignment, Figma | Unique code (e.g. "BKG-0045") |
| Booking | `userId` | UUID | Yes | No | Assignment, Frontend | Foreign key to `User.id` |
| Booking | `serviceName` | String (255) | Yes | No | Assignment, Frontend | Service name (e.g. "Home Deep Cleaning") |
| Booking | `category` | String (100) | Yes | No | Frontend | Service category (e.g. "Cleaning", "Plumbing", "Electrical") |
| Booking | `scheduledAt` | DateTime | Yes | No | Assignment, Frontend | Scheduled start datetime |
| Booking | `durationHours` | Decimal(4, 2) | Yes | No | Assignment, Figma | Duration in hours (e.g. 1.50) |
| Booking | `endTime` | DateTime | Yes | No | Assignment, Figma | Derived/persisted end datetime |
| Booking | `location` | String (255) | Yes | No | Assignment, Figma | Meeting place (e.g. "Virtual Consultation Room - Zoom") |
| Booking | `customerNotes` | Text | No | Yes | Assignment, Figma | Special client instructions |
| Booking | `status` | Enum (`CONFIRMED`, `PENDING`, `COMPLETED`, `CANCELLED`) | Yes | No | Assignment, Frontend | Booking lifecycle status |
| Booking | `amount` | Decimal(12, 2) | Yes | No | Assignment, Frontend | Billing price for service |
| Booking | `paymentStatus` | Enum (`PAID`, `PENDING`, `FAILED`) | Yes | No | Assignment, Figma | Payment ledger status |
| Booking | `paymentMethod` | String (100) | Yes | No | Assignment, Figma | Method used (e.g. "Credit Card (Visa ending in 4582)") |
| Booking | `invoiceCode` | String (30) | Yes | No | Assignment, Figma | Associated invoice code (e.g. "INV-98943"), unique |
| Booking | `createdAt` | DateTime | Yes | No | Technical | Creation timestamp |
| Booking | `updatedAt` | DateTime | Yes | No | Technical | Update timestamp |

### 3.6. BookingLog
Audit timeline for booking lifecycle (powers "Booking Lifecycle Logs").

| Entity | Field | Type | Required | Nullable | Source | Notes |
|---|---|---|---|---|---|---|
| BookingLog | `id` | UUID | Yes | No | Assignment | Primary key |
| BookingLog | `bookingId` | UUID | Yes | No | Assignment | Foreign key to `Booking.id` |
| BookingLog | `event` | String (100) | Yes | No | Assignment, Figma | Milestone name (e.g. "Booking Created", "Status Set to Confirmed") |
| BookingLog | `description` | String (500) | Yes | No | Assignment, Figma | Event explanation (e.g. "Outlook invite dispatched") |
| BookingLog | `createdAt` | DateTime | Yes | No | Assignment, Technical | Event timestamp |

### 3.7. ActivityLog
User-specific activity timeline (powers user detail "Recent Activity Log").

| Entity | Field | Type | Required | Nullable | Source | Notes |
|---|---|---|---|---|---|---|
| ActivityLog | `id` | UUID | Yes | No | Assignment | Primary key |
| ActivityLog | `userId` | UUID | Yes | No | Assignment | Foreign key to `User.id` |
| ActivityLog | `action` | String (100) | Yes | No | Assignment, Figma | Event headline (e.g. "Password Changed", "Profile Updated") |
| ActivityLog | `description` | String (500) | Yes | No | Assignment, Figma | Action details (e.g. "Updated phone number via self-service") |
| ActivityLog | `createdAt` | DateTime | Yes | No | Assignment, Technical | Action timestamp |

### 3.8. Alert
Operational system alerts for administrator attention (powers dashboard "System Alerts").

| Entity | Field | Type | Required | Nullable | Source | Notes |
|---|---|---|---|---|---|---|
| Alert | `id` | UUID | Yes | No | Assignment | Primary key |
| Alert | `title` | String (255) | Yes | No | Assignment, Figma | Alert title (e.g. "Server capacity at 92%") |
| Alert | `description` | String (500) | Yes | No | Assignment, Figma | Actionable description (e.g. "Scale compute resources") |
| Alert | `severity` | Enum (`INFO`, `WARNING`, `CRITICAL`) | Yes | No | Assignment, Frontend | Alert priority tone (`INFO` -> blue, `WARNING` -> amber, `CRITICAL` -> red) |
| Alert | `isResolved` | Boolean | Yes | No | Technical, Assumption | Flag whether the alert has been acknowledged/cleared |
| Alert | `createdAt` | DateTime | Yes | No | Assignment, Technical | Incident timestamp |

---

## 4. Relationships

| Entity A | Relationship | Entity B | Cardinality | Evidence |
|---|---|---|---|---|
| **User** | has many | **Transaction** | 1 : N | User detail page displays "Recent Transactions" (5 items); Transaction detail displays Customer Profile Summary and Related Customer Ledger Entries. Foreign key: `Transaction.userId -> User.id`. |
| **Transaction** | has many | **TransactionStatusHistory** | 1 : N | Transaction detail page features "Processing History" timeline tracking steps (Initiated -> Authorized -> Completed). Foreign key: `TransactionStatusHistory.transactionId -> Transaction.id`. |
| **User** | has many | **Booking** | 1 : N | User detail page displays "Recent Bookings" (5 items); Booking detail displays Customer Overview with total completed bookings count. Foreign key: `Booking.userId -> User.id`. |
| **Booking** | has many | **BookingLog** | 1 : N | Booking detail page features "Booking Lifecycle Logs" tracking progression (Created -> Assigned -> Confirmed -> Completed). Foreign key: `BookingLog.bookingId -> Booking.id`. |
| **User** | has many | **ActivityLog** | 1 : N | User detail page displays "Recent Activity" vertical timeline showing security events and profile edits. Foreign key: `ActivityLog.userId -> User.id`. |

---

## 5. Enums & Statuses

| Enum | Values | Evidence | Usage |
|---|---|---|---|
| `AdminRole` | `SUPER_ADMIN`, `ADMIN` | Figma, Frontend Profile (`profile-view.tsx`), Assignment | Determines admin privileges in the dashboard. |
| `UserRole` | `ADMIN`, `EDITOR`, `VIEWER` | Assignment, Frontend (`users/types.ts`), Figma | Role assigned to customers/users in directory. |
| `UserStatus` | `ACTIVE`, `INACTIVE`, `SUSPENDED` | Assignment, Frontend (`users/types.ts`), Figma | Status badges in user directory and detail view. |
| `TransactionType` | `PAYMENT`, `REFUND`, `TRANSFER` | Assignment, Frontend (`transactions/utils.ts`), Figma | Type filter and badges in transaction tables. |
| `TransactionStatus` | `COMPLETED`, `PENDING`, `FAILED`, `REFUNDED` | Assignment, Frontend (`transactions/types.ts`, `derive.ts`), Figma | Payment state badges, status filter, and order breakdown charts. (Maps frontend "paid" to `COMPLETED`). |
| `BookingStatus` | `CONFIRMED`, `PENDING`, `COMPLETED`, `CANCELLED` | Assignment, Frontend (`bookings/types.ts`, `derive.ts`), Figma | Booking workflow status badges, directory filter, and chart breakdowns. |
| `PaymentStatus` | `PAID`, `PENDING`, `FAILED` | Assignment, Figma (`booking-detail-desktop.tsx`), Frontend | Payment ledger breakdown for bookings. |
| `AlertSeverity` | `INFO`, `WARNING`, `CRITICAL` | Assignment, Frontend (`system-alerts.tsx`: "info", "warning", "danger") | Color tones for dashboard alerts. |
