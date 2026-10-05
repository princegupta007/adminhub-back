# Entity Relationship Diagram (ERD)

This document visualizes the complete database schema for Miles Admin Hub API using Mermaid ER notation.

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
        timestamp createdAt
        timestamp updatedAt
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
        timestamp lastLoginAt
        timestamp joinedAt
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
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
        timestamp settledAt
        timestamp createdAt
        timestamp updatedAt
    }

    TRANSACTION_STATUS_HISTORY {
        uuid id PK
        uuid transactionId FK
        enum status
        varchar_500 note
        timestamp createdAt
    }

    BOOKING {
        uuid id PK
        varchar_30 bookingCode UK
        uuid userId FK
        varchar_255 serviceName
        varchar_100 category
        timestamp scheduledAt
        decimal_4_2 durationHours
        timestamp endTime
        varchar_255 location
        text customerNotes
        enum status
        decimal_12_2 amount
        enum paymentStatus
        varchar_100 paymentMethod
        varchar_30 invoiceCode UK
        timestamp createdAt
        timestamp updatedAt
    }

    BOOKING_LOG {
        uuid id PK
        uuid bookingId FK
        varchar_100 event
        varchar_500 description
        timestamp createdAt
    }

    ACTIVITY_LOG {
        uuid id PK
        uuid userId FK
        varchar_100 action
        varchar_500 description
        timestamp createdAt
    }

    ALERT {
        uuid id PK
        varchar_255 title
        varchar_500 description
        enum severity
        boolean isResolved
        timestamp createdAt
    }

    USER ||--o{ TRANSACTION : "places"
    TRANSACTION ||--o{ TRANSACTION_STATUS_HISTORY : "tracks"
    USER ||--o{ BOOKING : "schedules"
    BOOKING ||--o{ BOOKING_LOG : "records"
    USER ||--o{ ACTIVITY_LOG : "generates"
```

---

## Relationship Summary

| Parent Entity | Relationship | Child Entity | Cardinality | Foreign Key | Cascade Rule | Business Meaning |
|---|---|---|---|---|---|---|
| `User` | places | `Transaction` | `1 : N` | `Transaction.userId` | `ON DELETE RESTRICT` | A user can execute many transactions. Financial records are preserved even if user is suspended. |
| `Transaction` | tracks | `TransactionStatusHistory` | `1 : N` | `TransactionStatusHistory.transactionId` | `ON DELETE CASCADE` | Each transaction has a sequential timeline of status transitions and processing notes. |
| `User` | schedules | `Booking` | `1 : N` | `Booking.userId` | `ON DELETE RESTRICT` | A user can reserve many bookings and appointments across various service categories. |
| `Booking` | records | `BookingLog` | `1 : N` | `BookingLog.bookingId` | `ON DELETE CASCADE` | Each booking logs lifecycle events (Creation, Assignment, Confirmation, Rescheduling). |
| `User` | generates | `ActivityLog` | `1 : N` | `ActivityLog.userId` | `ON DELETE CASCADE` | Users accumulate security and account update audit entries displayed on their detail page. |
| *(None)* | standalone | `Admin` | Independent | N/A | N/A | Administrators authenticate and manage the platform via JWT tokens. |
| *(None)* | standalone | `Alert` | Independent | N/A | N/A | System alerts are triggered globally by system health conditions and pending queues. |
