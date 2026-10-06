import { PrismaClient, AdminRole, UserRole, UserStatus, TransactionType, TransactionStatus, BookingStatus, PaymentStatus, AlertSeverity } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const FIRST_NAMES = [
  'Sarah', 'John', 'Aubrey', 'Michael', 'Emma', 'Lucas', 'Olivia', 'Liam', 'Sophia', 'Noah',
  'Isabella', 'James', 'Mia', 'Benjamin', 'Charlotte', 'Alexander', 'Amelia', 'Ethan', 'Harper', 'Daniel',
  'Evelyn', 'Matthew', 'Abigail', 'Henry', 'Emily', 'Jackson', 'Elizabeth', 'Samuel', 'Sofia', 'Sebastian',
  'Avery', 'David', 'Ella', 'Joseph', 'Scarlett', 'Carter', 'Grace', 'Owen', 'Chloe', 'Wyatt',
  'Victoria', 'Jack', 'Riley', 'Luke', 'Aria', 'Levi', 'Lily', 'Zoey', 'Oliver', 'Elena',
];

const LAST_NAMES = [
  'Jenkins', 'Doe', 'Wagner', 'Chen', 'Watson', 'Silva', 'Brown', 'Johnson', 'Davis', 'Miller',
  'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson',
  'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen',
  'Young', 'Hernandez', 'King', 'Wright', 'Lopez', 'Hill', 'Scott', 'Green', 'Adams', 'Baker',
  'Gonzalez', 'Nelson', 'Carter', 'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker',
];

const CITIES = ['San Francisco', 'New York', 'Seattle', 'Austin', 'Chicago', 'Boston', 'Los Angeles', 'Denver', 'Atlanta', 'Portland'];
const STATES = ['CA', 'NY', 'WA', 'TX', 'IL', 'MA', 'CA', 'CO', 'GA', 'OR'];

const SERVICES = [
  { name: 'Home Deep Cleaning', category: 'Cleaning', price: 149.00, duration: 2.0 },
  { name: 'Weekly House Keeping', category: 'Cleaning', price: 89.00, duration: 1.5 },
  { name: 'Plumbing Inspection', category: 'Plumbing', price: 120.00, duration: 1.0 },
  { name: 'AC Service & Repair', category: 'Appliances', price: 175.00, duration: 1.5 },
  { name: 'Electrical Wiring Check', category: 'Electrical', price: 160.00, duration: 1.5 },
  { name: 'Painting – Living Room', category: 'Painting', price: 350.00, duration: 3.0 },
  { name: 'Carpentry Work', category: 'Carpentry', price: 135.00, duration: 2.0 },
  { name: 'Pest Control Treatment', category: 'Pest Control', price: 110.00, duration: 1.0 },
  { name: 'Garden Maintenance', category: 'Gardening', price: 95.00, duration: 1.5 },
  { name: 'Salon at Home – Women', category: 'Beauty', price: 85.00, duration: 1.0 },
  { name: 'Massage Therapy', category: 'Wellness', price: 120.00, duration: 1.0 },
  { name: 'Interior Consultation', category: 'Design', price: 210.00, duration: 1.5 },
];

const PRODUCTS = [
  'iPhone 13 Pro',
  'MacBook Air M2',
  'Dell UltraSharp 27" 4K Monitor',
  'Sony WH-1000XM5 Headphones',
  'Logitech MX Master 3S',
  'Annual Maintenance Plan',
  'Cloud Infrastructure Consultation',
  'Enterprise Security Audit',
  'Office Furniture Bundle',
  'Keychron K2 Mechanical Keyboard',
];

const PAYMENT_METHODS = [
  'Credit Card (Visa ending in 4582)',
  'Credit Card (Mastercard ending in 8821)',
  'Credit Card (Amex ending in 3109)',
  'Direct PayPal Link',
  'Apple Pay (Visa *9012)',
];

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Clean existing records in referential order
  console.log('Clearing existing records...');
  await prisma.activityLog.deleteMany();
  await prisma.transactionStatusHistory.deleteMany();
  await prisma.bookingLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.user.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.workspaceSetting.deleteMany();
  await prisma.admin.deleteMany();

  // Reset database sequences so codes start from 1
  try {
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE user_code_seq RESTART WITH 1;`);
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE txn_code_seq RESTART WITH 1;`);
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE booking_code_seq RESTART WITH 1;`);
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE invoice_code_seq RESTART WITH 1;`);
  } catch {
    console.log('Sequences will initialize automatically.');
  }

  // 2. Seed Admin
  console.log('Seeding Super Admin...');
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('Admin@123', saltRounds);

  const admin = await prisma.admin.create({
    data: {
      name: 'Sarah Jenkins',
      email: 'admin@miles.io',
      passwordHash,
      role: AdminRole.SUPER_ADMIN,
      avatarUrl: 'https://i.pravatar.cc/150?u=admin_sarah',
      phone: '+1 (555) 014-2210',
      timezone: 'PST (UTC-08:00)',
      twoFactorEnabled: true,
    },
  });
  console.log(`✓ Admin created: ${admin.email} (password: Admin@123)`);

  const staff = await prisma.admin.create({
    data: {
      name: 'Michael Chen',
      email: 'staff@miles.io',
      passwordHash,
      role: AdminRole.ADMIN,
      avatarUrl: 'https://i.pravatar.cc/150?u=admin_michael',
      phone: '+1 (555) 014-8832',
      timezone: 'EST (UTC-05:00)',
      twoFactorEnabled: false,
    },
  });
  console.log(`✓ Staff Admin created: ${staff.email} (password: Admin@123)`);

  // 3. Seed Users (50 realistic app customers)
  console.log('Seeding 50 App Customers...');
  const now = new Date();
  const users = [];

  for (let i = 0; i < 50; i++) {
    const firstName = FIRST_NAMES[i];
    const lastName = LAST_NAMES[i];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
    const userCode = `USR-${String(i + 1).padStart(4, '0')}`;
    const cityIndex = i % CITIES.length;

    // Distribute joinedAt across the last 12 months with recent concentration
    const daysAgo = Math.floor((i / 50) * 330);
    const joinedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const lastLoginAt = new Date(now.getTime() - (i % 7) * 24 * 60 * 60 * 1000);

    const role = i === 0 ? UserRole.ADMIN : i % 5 === 0 ? UserRole.EDITOR : UserRole.VIEWER;
    const status = i % 15 === 0 ? UserStatus.SUSPENDED : i % 10 === 0 ? UserStatus.INACTIVE : UserStatus.ACTIVE;

    const user = await prisma.user.create({
      data: {
        userCode,
        firstName,
        lastName,
        email,
        phone: `+1 (555) ${String(100 + i * 17).padStart(3, '0')}-${String(1000 + i * 37).padStart(4, '0')}`,
        dateOfBirth: new Date(1985 + (i % 15), i % 12, (i % 28) + 1),
        addressLine: `${100 + i * 12} Market Street, Suite ${10 + i}`,
        city: CITIES[cityIndex],
        state: STATES[cityIndex],
        country: 'USA',
        avatarUrl: `https://i.pravatar.cc/150?u=usr_${i + 1}`,
        role,
        status,
        twoFactorEnabled: i % 3 === 0,
        joinedAt,
        lastLoginAt,
      },
    });
    users.push(user);
  }
  console.log(`✓ Created ${users.length} users`);

  // 4. Seed Transactions (120+ across last 12 calendar months)
  console.log('Seeding 120 Transactions with audit status histories...');
  const transactions = [];

  for (let i = 0; i < 120; i++) {
    const user = users[i % users.length];
    const txnCode = `TXN-${String(i + 1).padStart(4, '0')}`;
    const reference = `ref_${992000000 + i * 73}`;
    const product = PRODUCTS[i % PRODUCTS.length];
    const paymentMethod = PAYMENT_METHODS[i % PAYMENT_METHODS.length];

    // Spread across 12 calendar months
    const monthOffset = i % 12;
    const dayOffset = (i * 3) % 28;
    const createdAt = new Date(now.getFullYear(), now.getMonth() - monthOffset, dayOffset + 1, 10 + (i % 10), (i * 7) % 60);

    // Types: mostly PAYMENT, some REFUND and TRANSFER
    let type = TransactionType.PAYMENT;
    let status = TransactionStatus.COMPLETED;
    let baseAmount = 45.0 + (i % 15) * 85.0;

    if (i % 15 === 0) {
      type = TransactionType.REFUND;
      status = TransactionStatus.REFUNDED;
      baseAmount = -baseAmount;
    } else if (i % 20 === 0) {
      type = TransactionType.TRANSFER;
      status = TransactionStatus.COMPLETED;
    } else if (i % 8 === 0) {
      status = TransactionStatus.PENDING;
    } else if (i % 25 === 0) {
      status = TransactionStatus.FAILED;
    }

    const gatewayFee = type === TransactionType.REFUND ? 0.0 : Math.round(Math.abs(baseAmount) * 0.029 * 100) / 100;
    const subtotal = Math.round((Math.abs(baseAmount) - gatewayFee) * 100) / 100;
    const total = baseAmount;
    const settledAt = status === TransactionStatus.COMPLETED ? new Date(createdAt.getTime() + 1000 * 60 * 15) : null;

    const txn = await prisma.transaction.create({
      data: {
        txnCode,
        reference,
        userId: user.id,
        type,
        status,
        amount: total,
        currency: 'USD',
        productName: product,
        paymentMethod,
        gatewayFee,
        subtotal,
        total,
        settledAt,
        createdAt,
        statusHistory: {
          create: [
            {
              status: TransactionStatus.PENDING,
              note: 'Checkout session initiated',
              createdAt: new Date(createdAt.getTime() - 1000 * 60 * 5),
            },
            ...(status === TransactionStatus.COMPLETED
              ? [
                  {
                    status: TransactionStatus.PENDING,
                    note: 'Processing & Authorized by payment gateway',
                    createdAt: new Date(createdAt.getTime() - 1000 * 60 * 2),
                  },
                  {
                    status: TransactionStatus.COMPLETED,
                    note: 'Completed & Disbursed to merchant bank account',
                    adminId: admin.id,
                    createdAt,
                  },
                ]
              : status === TransactionStatus.REFUNDED
                ? [
                    {
                      status: TransactionStatus.REFUNDED,
                      note: 'Customer refund approved & credited',
                      adminId: admin.id,
                      createdAt,
                    },
                  ]
                : status === TransactionStatus.FAILED
                  ? [
                      {
                        status: TransactionStatus.FAILED,
                        note: 'Gateway declined: Insufficient funds or invalid CVC',
                        createdAt,
                      },
                    ]
                  : []),
          ],
        },
      },
    });
    transactions.push(txn);
  }
  console.log(`✓ Created ${transactions.length} transactions with audit histories`);

  // 5. Seed Bookings (60 bookings: past and upcoming)
  console.log('Seeding 60 Bookings with lifecycle logs...');
  const bookings = [];

  for (let i = 0; i < 60; i++) {
    const user = users[i % users.length];
    const service = SERVICES[i % SERVICES.length];
    const bookingCode = `BKG-${String(i + 1).padStart(4, '0')}`;
    const invoiceCode = `INV-${String(10000 + i + 1).padStart(5, '0')}`;

    // -60 days past to +30 days future
    const dayDelta = (i - 40) * 2;
    const scheduledAt = new Date(now.getTime() + dayDelta * 24 * 60 * 60 * 1000);
    scheduledAt.setHours(9 + (i % 8), (i % 2) * 30, 0, 0);

    const durationHours = service.duration;
    const endTime = new Date(scheduledAt.getTime() + durationHours * 60 * 60 * 1000);

    let status = BookingStatus.COMPLETED;
    let paymentStatus = PaymentStatus.PAID;

    if (dayDelta > 0) {
      status = i % 4 === 0 ? BookingStatus.PENDING : BookingStatus.CONFIRMED;
      paymentStatus = i % 4 === 0 ? PaymentStatus.PENDING : PaymentStatus.PAID;
    } else if (i % 7 === 0) {
      status = BookingStatus.CANCELLED;
      paymentStatus = PaymentStatus.FAILED;
    }

    const booking = await prisma.booking.create({
      data: {
        bookingCode,
        userId: user.id,
        serviceName: service.name,
        category: service.category,
        scheduledAt,
        durationHours,
        endTime,
        location: i % 2 === 0 ? 'Virtual - Zoom Link Provided' : 'On-site Client Office',
        customerNotes: i % 3 === 0 ? 'Please review prior transaction statements and bring expansion plans.' : null,
        status,
        amount: service.price,
        paymentStatus,
        paymentMethod: PAYMENT_METHODS[i % PAYMENT_METHODS.length],
        invoiceCode,
        createdAt: new Date(scheduledAt.getTime() - 7 * 24 * 60 * 60 * 1000),
        lifecycleLogs: {
          create: [
            {
              event: 'Booking Created',
              description: 'Client self-service reservation created',
              createdAt: new Date(scheduledAt.getTime() - 7 * 24 * 60 * 60 * 1000),
            },
            {
              event: 'Status Set to Confirmed',
              description: 'Consultant assigned and schedule locked',
              adminId: admin.id,
              createdAt: new Date(scheduledAt.getTime() - 6 * 24 * 60 * 60 * 1000),
            },
            ...(status === BookingStatus.COMPLETED
              ? [
                  {
                    event: 'Session Completed',
                    description: 'Consultation concluded successfully with client signoff',
                    createdAt: endTime,
                  },
                ]
              : status === BookingStatus.CANCELLED
                ? [
                    {
                      event: 'Booking Cancelled',
                      description: 'Cancelled per client reschedule notice',
                      adminId: admin.id,
                      createdAt: new Date(scheduledAt.getTime() - 2 * 24 * 60 * 60 * 1000),
                    },
                  ]
                : []),
          ],
        },
      },
    });
    bookings.push(booking);
  }
  console.log(`✓ Created ${bookings.length} bookings with lifecycle logs`);

  // 6. Seed Activity Logs for User Detail timelines
  console.log('Seeding Activity Logs...');
  for (let i = 0; i < 15; i++) {
    const user = users[i];
    await prisma.activityLog.createMany({
      data: [
        {
          userId: user.id,
          action: 'Password Changed',
          description: 'Security credential updated via self-service portal',
          createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          userId: user.id,
          action: 'Profile Updated',
          description: 'Primary contact phone and billing address confirmed',
          createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          userId: user.id,
          action: 'User Logged In',
          description: 'Web dashboard session initiated from Chrome / macOS',
          createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }
  console.log('✓ Created activity logs');

  // 7. Seed System Alerts
  console.log('Seeding System Alerts...');
  await prisma.alert.createMany({
    data: [
      {
        title: 'Server capacity at 92%',
        description: 'Scale compute cluster resources to prevent latency spikes',
        severity: AlertSeverity.CRITICAL,
        isResolved: false,
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        title: '18 transactions pending review',
        description: 'Payment authorizations require manual risk verification',
        severity: AlertSeverity.WARNING,
        isResolved: false,
        createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      },
      {
        title: 'System maintenance scheduled',
        description: 'Database index maintenance window planned for Sunday 02:00 UTC',
        severity: AlertSeverity.INFO,
        isResolved: false,
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    ],
  });
  // 8. Seed Workspace Settings
  console.log('Seeding Workspace Settings...');
  await prisma.workspaceSetting.create({
    data: {
      workspaceName: 'AdminHub',
      supportEmail: 'support@adminhub.io',
      currency: 'USD',
      timezone: 'PST (UTC-08:00)',
    },
  });
  console.log('✓ Created default workspace settings');

  // Synchronize database sequences to highest seeded record numbers
  await prisma.$executeRawUnsafe(`SELECT setval('user_code_seq', 50, true);`);
  await prisma.$executeRawUnsafe(`SELECT setval('txn_code_seq', 120, true);`);
  await prisma.$executeRawUnsafe(`SELECT setval('booking_code_seq', 60, true);`);
  await prisma.$executeRawUnsafe(`SELECT setval('invoice_code_seq', 60, true);`);
  console.log('✓ Synchronized database sequences (user_code_seq -> 50, txn_code_seq -> 120, booking_code_seq -> 60, invoice_code_seq -> 60)');

  console.log('✨ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
