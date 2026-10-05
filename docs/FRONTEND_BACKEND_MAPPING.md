# Frontend to Backend Data Mapping

This document provides a trace for every screen in the frontend (`E:\projects\adminhub`) down through the API endpoints, DTOs, service layer operations, and PostgreSQL Prisma entities.

---

## 1. Users Directory Screen

**Frontend Location:** `src/app/users/page.tsx` → `src/features/users/components/users-view.tsx` & `users-desktop-view.tsx`

```text
Users Screen (Table & Search/Filter Toolbar)
    ↓
GET /api/v1/users?page=1&limit=8&q=sarah&role=admin&status=active&sortBy=joinDate&order=desc
    ↓
UsersQueryDto {
  page: number = 1;
  limit: number = 8;
  q?: string = "sarah";
  role?: UserRole = UserRole.ADMIN;
  status?: UserStatus = UserStatus.ACTIVE;
  sortBy?: string = "joinDate";
  order?: "asc" | "desc" = "desc";
}
    ↓
UsersService.findAll(query: UsersQueryDto)
    ↓
Prisma: prisma.user.findMany({
  where: {
    deletedAt: null,
    role: query.role,
    status: query.status,
    OR: [
      { firstName: { contains: query.q, mode: 'insensitive' } },
      { lastName: { contains: query.q, mode: 'insensitive' } },
      { email: { contains: query.q, mode: 'insensitive' } },
      { userCode: { contains: query.q, mode: 'insensitive' } }
    ]
  },
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { [mappedSortField]: order }
})
    ↓
User Table (`User`)
  - id, userCode, firstName, lastName, email, phone, role, status,
    twoFactorEnabled, joinedAt, lastLoginAt, avatarUrl
    ↓
Mapped API Response:
{
  data: [
    {
      id: "...",
      userCode: "USR-0001",
      name: "Sarah Jenkins", // firstName + " " + lastName
      email: "sarah@example.com",
      phone: "+1 555-014-2210",
      avatarUrl: "https://...",
      role: "ADMIN",
      status: "ACTIVE",
      joinDate: "2024-03-15T00:00:00.000Z", // joinedAt
      lastActive: "2026-10-05T19:30:00.000Z" // lastLoginAt
    }
  ],
  meta: { page: 1, limit: 8, total: 1420, totalPages: 178 }
}
```

**Header Mini-Stats:**
```text
Users Screen (Top Summary Cards: Total Users, Active Users, New This Month)
    ↓
GET /api/v1/users/stats
    ↓
UsersService.getStats()
    ↓
Prisma Queries:
  - Total users: prisma.user.count({ where: { deletedAt: null } })
  - Active users: prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } })
  - New this month: prisma.user.count({ where: { deletedAt: null, joinedAt: { gte: startOfMonth } } })
  - Previous month counts for MoM % calculations
    ↓
User Table (`User`)
```

---

## 2. User Detail Screen

**Frontend Location:** `src/app/users/[id]/page.tsx` → `src/features/users/components/user-detail-view.tsx`

```text
User Detail Screen (#USR-0001)
    ↓
GET /api/v1/users/:code (e.g. /api/v1/users/USR-0001)
    ↓
UsersService.findByCodeOrId(code: string)
    ↓
Prisma Query with Relations:
prisma.user.findFirst({
  where: {
    deletedAt: null,
    OR: [{ userCode: code }, { id: isUuid ? code : undefined }]
  },
  include: {
    transactions: {
      take: 5,
      orderBy: { createdAt: 'desc' }
    },
    bookings: {
      take: 5,
      orderBy: { scheduledAt: 'desc' }
    },
    activities: {
      take: 5,
      orderBy: { createdAt: 'desc' }
    }
  }
})
    ↓
Database Entities & Fields:
  1. `User` Table:
     - Profile Header: firstName, lastName, avatarUrl, role, status
     - Personal Info: firstName, lastName, email, phone, dateOfBirth, addressLine, city, state, country
     - Account Details: userCode, joinedAt, lastLoginAt, role, twoFactorEnabled
  2. `Transaction` Table (`recentTransactions`):
     - id, txnCode, createdAt, amount, status
  3. `Booking` Table (`recentBookings`):
     - id, bookingCode, serviceName, scheduledAt, status
  4. `ActivityLog` Table (`recentActivity`):
     - id, action (title), description (desc), createdAt (time)
    ↓
Mapped API Response:
Single JSON object directly (no envelope) matching UserDetailView specifications.
```

---

## 3. Transactions Screen

**Frontend Location:** `src/app/transactions/page.tsx` → `src/features/transactions/components/transactions-view.tsx` & `transactions-desktop-view.tsx`

```text
Transactions Ledger Screen
    ↓
GET /api/v1/transactions?page=1&limit=8&type=payment&status=completed&sortBy=createdAt&order=desc
    ↓
TransactionsQueryDto {
  page: number = 1;
  limit: number = 8;
  q?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string = "createdAt";
  order?: "asc" | "desc" = "desc";
}
    ↓
TransactionsService.findAll(query: TransactionsQueryDto)
    ↓
Prisma: prisma.transaction.findMany({
  where: {
    type: query.type,
    status: query.status,
    amount: { gte: query.minAmount, lte: query.maxAmount },
    createdAt: { gte: query.dateFrom, lte: query.dateTo },
    OR: [
      { txnCode: { contains: query.q, mode: 'insensitive' } },
      { reference: { contains: query.q, mode: 'insensitive' } },
      { user: { firstName: { contains: query.q, mode: 'insensitive' } } },
      { user: { lastName: { contains: query.q, mode: 'insensitive' } } },
      { user: { email: { contains: query.q, mode: 'insensitive' } } }
    ]
  },
  include: {
    user: {
      select: { firstName: true, lastName: true, email: true, avatarUrl: true }
    }
  },
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { [mappedSortField]: order }
})
    ↓
Transaction Table (`Transaction`) & User Table (`User`)
  - Transaction: id, txnCode, reference, type, status, amount, currency,
    paymentMethod, createdAt, settledAt
  - User: firstName, lastName, email, avatarUrl
    ↓
Mapped API Response:
{
  data: [
    {
      id: "...",
      txnCode: "TXN-0017",
      customerName: "Sarah Jenkins",
      customerEmail: "sarah@example.com",
      customerAvatar: "https://...",
      type: "PAYMENT",
      amount: 1250.00,
      status: "COMPLETED",
      paymentMethod: "Credit Card (Visa ending in 4582)",
      createdAt: "2026-10-04T14:20:00.000Z"
    }
  ],
  meta: { page: 1, limit: 8, total: 2840, totalPages: 355 }
}
```

**Header Mini-Stats:**
```text
Transactions Screen (Top Summary: Total Transactions, Total Volume, Avg. Transaction, Success Rate)
    ↓
GET /api/v1/transactions/stats
    ↓
TransactionsService.getStats()
    ↓
Prisma Aggregations:
  - count(*)
  - sum(amount) where status = 'COMPLETED'
  - avg(amount) where status = 'COMPLETED'
  - success rate: count(status = 'COMPLETED') / count(*) * 100
    ↓
Transaction Table (`Transaction`)
```

---

## 4. Transaction Detail Screen

**Frontend Location:** `src/app/transactions/[id]/page.tsx` → `src/features/transactions/components/transaction-detail-desktop.tsx`

```text
Transaction Detail Screen (Invoice #TXN-0017)
    ↓
GET /api/v1/transactions/:code (e.g. /api/v1/transactions/TXN-0017)
    ↓
TransactionsService.findByCode(code: string)
    ↓
Prisma Query with Relations:
prisma.transaction.findFirst({
  where: { OR: [{ txnCode: code }, { id: isUuid ? code : undefined }] },
  include: {
    user: {
      select: { id: true, userCode: true, firstName: true, lastName: true, email: true, avatarUrl: true }
    },
    statusHistory: {
      orderBy: { createdAt: 'desc' }
    }
  }
})
+ Secondary Query for Related Ledger:
prisma.transaction.findMany({
  where: { userId: txn.userId, id: { not: txn.id } },
  take: 5,
  orderBy: { createdAt: 'desc' }
})
    ↓
Database Entities & Fields:
  1. `Transaction` Table:
     - Header: txnCode, reference, status, settledAt, createdAt
     - Invoice Box: type, paymentMethod, gatewayFee, subtotal, total (grand total)
  2. `User` Table:
     - Customer Profile Summary: userCode, firstName, lastName, email, avatarUrl
  3. `TransactionStatusHistory` Table:
     - Processing History Timeline: status, note, createdAt
  4. `Transaction` Table (`relatedLedger`):
     - Related entries: txnCode, paymentMethod, amount, status, settledAt
    ↓
Mapped API Response:
Single JSON object directly with nested customer, statusHistory, and relatedLedger.
```

---

## 5. Bookings Directory Screen

**Frontend Location:** `src/app/bookings/page.tsx` → `src/features/bookings/components/bookings-view.tsx` & `bookings-desktop-view.tsx`

```text
Bookings Directory Screen
    ↓
GET /api/v1/bookings?page=1&limit=8&status=confirmed&service=cleaning&sortBy=scheduledAt&order=asc
    ↓
BookingsQueryDto {
  page: number = 1;
  limit: number = 8;
  q?: string;
  status?: BookingStatus;
  when?: "upcoming" | "past";
  service?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string = "scheduledAt";
  order?: "asc" | "desc" = "asc";
}
    ↓
BookingsService.findAll(query: BookingsQueryDto)
    ↓
Prisma: prisma.booking.findMany({
  where: {
    status: query.status,
    category: query.service,
    scheduledAt: {
      gte: query.when === 'upcoming' ? new Date() : query.dateFrom,
      lte: query.when === 'past' ? new Date() : query.dateTo
    },
    OR: [
      { bookingCode: { contains: query.q, mode: 'insensitive' } },
      { serviceName: { contains: query.q, mode: 'insensitive' } },
      { user: { firstName: { contains: query.q, mode: 'insensitive' } } },
      { user: { lastName: { contains: query.q, mode: 'insensitive' } } }
    ]
  },
  include: {
    user: {
      select: { firstName: true, lastName: true, email: true, avatarUrl: true }
    }
  },
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { [mappedSortField]: order }
})
    ↓
Booking Table (`Booking`) & User Table (`User`)
  - Booking: id, bookingCode, serviceName, category, scheduledAt,
    durationHours, status, amount, paymentStatus
  - User: firstName, lastName, email, avatarUrl
    ↓
Mapped API Response:
{
  data: [
    {
      id: "...",
      bookingCode: "BKG-0045",
      customerName: "Sarah Jenkins",
      serviceName: "Home Deep Cleaning",
      category: "Cleaning",
      scheduledAt: "2026-10-12T10:00:00.000Z",
      durationHours: 1.5,
      status: "CONFIRMED",
      amount: 149.00
    }
  ],
  meta: { page: 1, limit: 8, total: 480, totalPages: 60 }
}
```

**Header Stat Cards:**
```text
Bookings Screen (Top Cards: Total Bookings, Active Bookings, Completed Bookings, Cancelled Bookings)
    ↓
GET /api/v1/bookings/stats
    ↓
BookingsService.getStats()
    ↓
Prisma Queries:
  - count(*)
  - count(status in ['CONFIRMED', 'PENDING'])
  - count(status = 'COMPLETED')
  - count(status = 'CANCELLED')
  - Previous calendar month counts for MoM % change
    ↓
Booking Table (`Booking`)
```

---

## 6. Booking Detail Screen

**Frontend Location:** `src/app/bookings/[id]/page.tsx` → `src/features/bookings/components/booking-detail-desktop.tsx`

```text
Booking Detail Screen (#BKG-0045)
    ↓
GET /api/v1/bookings/:code (e.g. /api/v1/bookings/BKG-0045)
    ↓
BookingsService.findByCode(code: string)
    ↓
Prisma Query with Relations & Sub-counts:
prisma.booking.findFirst({
  where: { OR: [{ bookingCode: code }, { id: isUuid ? code : undefined }] },
  include: {
    user: {
      select: {
        id: true,
        userCode: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        _count: {
          select: { bookings: { where: { status: 'COMPLETED' } } }
        }
      }
    },
    lifecycleLogs: {
      orderBy: { createdAt: 'desc' }
    }
  }
})
    ↓
Database Entities & Fields:
  1. `Booking` Table:
     - Header: bookingCode, status
     - Meeting Logistics: serviceName, scheduledAt, durationHours, endTime, location, customerNotes
     - Payment Ledger Breakdown: amount (Billing Amount), paymentStatus, invoiceCode
  2. `User` Table:
     - Customer Overview: firstName, lastName, email, avatarUrl,
       completedBookingsCount (from `user._count.bookings`)
  3. `BookingLog` Table:
     - Booking Lifecycle Logs Timeline: event, description, createdAt
    ↓
Mapped API Response:
Single JSON object directly with nested customer and lifecycleLogs.
```

---

## 7. Dashboard Screen

**Frontend Location:** `src/app/page.tsx` → `src/features/dashboard/components/dashboard-view.tsx`

```text
Dashboard Screen (Overview, Analytics, Reports Tabs)
    ↓
Three Targeted Aggregation Requests:
    ↓
1. GET /api/v1/dashboard/stats
   → DashboardService.getKpiStats()
   → Computes MoM deltas for Users, Revenue, Active Bookings, Pending Transactions.
   → Powers 4 KPI cards and Totals.

2. GET /api/v1/dashboard/charts?range=6m
   → DashboardService.getCharts(range: '6m')
   → Aggregates:
       - `revenueByPeriod`: Grouped by month/day (Transaction where status = 'COMPLETED')
       - `ordersByStatus`: Grouped by status with count & sum(amount)
       - `bookingsByStatus`: Grouped by status with count & sum(amount)
       - `bookingsByCategory`: Grouped by category with count & sum(amount)
       - `topProducts`: Grouped by productName with count & sum(amount)
   → Powers Revenue Area Chart, Orders Donut, Bookings Bar Chart, Top Products table.

3. GET /api/v1/dashboard/alerts
   → DashboardService.getAlerts()
   → Prisma: prisma.alert.findMany({ where: { isResolved: false }, orderBy: { createdAt: 'desc' } })
   → Powers System Alerts widget.

4. GET /api/v1/dashboard/health
   → DashboardService.getHealth()
   → Server uptime, average response time, active sessions estimate.
   → Powers System Health widget.

5. GET /api/v1/dashboard/recent-transactions?limit=6
   → DashboardService.getRecentTransactions(limit: 6)
   → Prisma: prisma.transaction.findMany({ take: 6, orderBy: { createdAt: 'desc' }, include: { user: true } })
   → Powers Recent Transactions dashboard table.
```

---

## 8. Authentication & Profile Screens

**Frontend Locations:**
- Login: `src/app/login/page.tsx` → `src/features/auth/components/login-view.tsx`
- Profile: `src/app/profile/page.tsx` → `src/features/profile/components/profile-view.tsx`

```text
Login Screen Form Submit
    ↓
POST /api/v1/auth/login { email, password }
    ↓
AuthService.login(dto: LoginDto)
    ↓
Prisma: prisma.admin.findUnique({ where: { email: dto.email } })
    ↓
bcrypt.compare(dto.password, admin.passwordHash)
    ↓
JwtService.signAsync({ sub: admin.id, email: admin.email, role: admin.role })
    ↓
Response: { accessToken, expiresIn: "1d", admin: { id, name, email, role, avatarUrl, twoFactorEnabled } }
```

```text
Admin Profile Screen / Sidebar User Badge / Topbar Avatar Menu
    ↓
GET /api/v1/auth/me (Bearer JWT)
    ↓
AuthService.getProfile(adminId: string)
    ↓
Prisma: prisma.admin.findUnique({ where: { id: adminId } })
    ↓
Response: Admin profile object (excluding passwordHash)
```
