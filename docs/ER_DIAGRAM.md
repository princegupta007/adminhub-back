# Entity Relationship Diagram (ERD) - Implemented Schema

This diagram visualizes the implemented PostgreSQL schema for Miles Admin Hub API in Mermaid ER notation.

```mermaid
erDiagram
    ADMIN {
        uuid id PK
        varchar_100 name
        varchar_255 email UK
        varchar_255 passwordHash
        enum role
        varchar_500 avatarUrl
        varchar_50 phone
        varchar_50 timezone
        boolean twoFactorEnabled
        timestamptz createdAt
        timestamptz updatedAt
    }

    USER {
        uuid id PK
        varchar_20 userCode UK
        varchar_100 firstName
        varchar_100 lastName
        varchar_255 email UK
        varchar_50 phone
        date dateOfBirth
        varchar_255 addressLine
        varchar_100 city
        varchar_100 state
        varchar_100 country
        varchar_500 avatarUrl
        enum role
        enum status
        boolean twoFactorEnabled
        timestamptz lastLoginAt
        timestamptz joinedAt
        timestamptz createdAt
        timestamptz updatedAt
        timestamptz deletedAt
    }

    TRANSACTION {
        uuid id PK
        varchar_30 txnCode UK
        varchar_50 reference UK
        uuid userId FK
        enum type
        enum status
        decimal_12_2 amount
        varchar_3 currency
        varchar_255 productName
        varchar_100 paymentMethod
        decimal_12_2 gatewayFee
        decimal_12_2 subtotal
        decimal_12_2 total
        timestamptz settledAt
        timestamptz createdAt
        timestamptz updatedAt
    }

    TRANSACTION_STATUS_HISTORY {
        uuid id PK
        uuid transactionId FK
        uuid adminId FK
        enum status
        varchar_500 note
        timestamptz createdAt
    }

    BOOKING {
        uuid id PK
        varchar_30 bookingCode UK
        uuid userId FK
        varchar_255 serviceName
        varchar_100 category
        timestamptz scheduledAt
        decimal_4_2 durationHours
        timestamptz endTime
        varchar_255 location
        text customerNotes
        enum status
        decimal_12_2 amount
        enum paymentStatus
        varchar_100 paymentMethod
        varchar_30 invoiceCode UK
        timestamptz createdAt
        timestamptz updatedAt
    }

    BOOKING_LOG {
        uuid id PK
        uuid bookingId FK
        uuid adminId FK
        varchar_100 event
        varchar_500 description
        timestamptz createdAt
    }

    ACTIVITY_LOG {
        uuid id PK
        uuid userId FK
        varchar_100 action
        varchar_500 description
        timestamptz createdAt
    }

    ALERT {
        uuid id PK
        varchar_255 title
        varchar_500 description
        enum severity
        boolean isResolved
        timestamptz createdAt
    }

    USER ||--o{ TRANSACTION : "places (1:N)"
    TRANSACTION ||--o{ TRANSACTION_STATUS_HISTORY : "tracks (1:N)"
    ADMIN |o--o{ TRANSACTION_STATUS_HISTORY : "audits (0:N)"
    USER ||--o{ BOOKING : "schedules (1:N)"
    BOOKING ||--o{ BOOKING_LOG : "records (1:N)"
    ADMIN |o--o{ BOOKING_LOG : "audits (0:N)"
    USER ||--o{ ACTIVITY_LOG : "generates (1:N)"
```

---

## Implemented Relationship & Key Summary

| Parent Entity | Relationship | Child Entity | Cardinality | Foreign Key | Delete Rule | Meaning & Audit Invariant |
|---|---|---|---|---|---|---|
| `User` | places | `Transaction` | `1 : N` | `Transaction.userId` | `RESTRICT` | Financial records are never removed even when customer account is soft-deleted. |
| `Transaction` | tracks | `TransactionStatusHistory` | `1 : N` | `TransactionStatusHistory.transactionId` | `CASCADE` | Transaction maintains an immutable chronological processing history log. |
| `Admin` | audits | `TransactionStatusHistory` | `0 : N` | `TransactionStatusHistory.adminId` | `SET NULL` | Records optional acting administrator who authorized/settled the transaction. |
| `User` | schedules | `Booking` | `1 : N` | `Booking.userId` | `RESTRICT` | User appointments across all service categories. |
| `Booking` | records | `BookingLog` | `1 : N` | `BookingLog.bookingId` | `CASCADE` | Booking lifecycle progression events. |
| `Admin` | audits | `BookingLog` | `0 : N` | `BookingLog.adminId` | `SET NULL` | Records optional acting administrator who rescheduled/cancelled the booking. |
| `User` | generates | `ActivityLog` | `1 : N` | `ActivityLog.userId` | `CASCADE` | User-centric security and profile update audit log feed. |
| *(None)* | standalone | `Alert` | `N/A` | `N/A` | `N/A` | Operational dashboard system alerts. |
| *(None)* | standalone | `Admin` | `N/A` | `N/A` | `N/A` | Authenticated operators managing the dashboard platform. |

---

## Database Sequences

| Sequence Name | Target Format | Concurrency Invariant |
|---|---|---|
| `user_code_seq` | `USR-0001` | Atomic PostgreSQL sequence allocation (`SELECT nextval('user_code_seq')`) |
| `txn_code_seq` | `TXN-0001` | Atomic PostgreSQL sequence allocation (`SELECT nextval('txn_code_seq')`) |
| `booking_code_seq` | `BKG-0001` | Atomic PostgreSQL sequence allocation (`SELECT nextval('booking_code_seq')`) |
| `invoice_code_seq` | `INV-10001` | Atomic PostgreSQL sequence allocation (`SELECT nextval('invoice_code_seq')`) |
