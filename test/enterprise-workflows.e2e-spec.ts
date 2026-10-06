import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  AdminRole,
  BookingStatus,
  PaymentStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Enterprise Workflows, Bulk Operations, Exports & Search (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let superAdminToken: string;
  let staffAdminToken: string;
  let testUser1Id: string;
  let testUser2Id: string;
  let refundTxnId: string;
  let rescheduleBookingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api/v1');

    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // 1. Fetch Super Admin
    const superAdmin = await prisma.admin.findUnique({
      where: { email: 'admin@miles.io' },
    });
    if (!superAdmin) throw new Error('Super admin not found');
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role,
    });

    // 2. Fetch or create Staff Admin (ADMIN role)
    let staffAdmin = await prisma.admin.findFirst({
      where: { role: AdminRole.ADMIN },
    });
    if (!staffAdmin) {
      staffAdmin = await prisma.admin.create({
        data: {
          email: 'staff_workflow@miles.io',
          name: 'Staff Workflow Admin',
          role: AdminRole.ADMIN,
          passwordHash: superAdmin.passwordHash,
        },
      });
    }
    staffAdminToken = jwtService.sign({
      sub: staffAdmin.id,
      email: staffAdmin.email,
      role: staffAdmin.role,
    });

    // 3. Create dedicated test users for bulk actions
    const u1 = await prisma.user.create({
      data: {
        userCode: 'USR-E2E-BLK1',
        firstName: 'BulkTestOne',
        lastName: 'E2E',
        email: 'bulk.e2e1@example.com',
        phone: '+1 555-010-0001',
        role: UserRole.VIEWER,
        status: UserStatus.ACTIVE,
      },
    });
    testUser1Id = u1.id;

    const u2 = await prisma.user.create({
      data: {
        userCode: 'USR-E2E-BLK2',
        firstName: 'BulkTestTwo',
        lastName: 'E2E',
        email: 'bulk.e2e2@example.com',
        phone: '+1 555-010-0002',
        role: UserRole.VIEWER,
        status: UserStatus.ACTIVE,
      },
    });
    testUser2Id = u2.id;

    // 4. Create dedicated transaction for refund testing
    const txn = await prisma.transaction.create({
      data: {
        txnCode: 'TXN-E2E-REFUND',
        reference: `ref_e2e_rf_${Date.now()}`,
        userId: testUser1Id,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.COMPLETED,
        amount: new Prisma.Decimal('250.00'),
        currency: 'USD',
        productName: 'E2E Refundable Service',
        paymentMethod: 'Credit Card (Visa)',
        gatewayFee: new Prisma.Decimal('7.25'),
        subtotal: new Prisma.Decimal('242.75'),
        total: new Prisma.Decimal('250.00'),
        settledAt: new Date(),
      },
    });
    refundTxnId = txn.id;

    // 5. Create dedicated booking for reschedule & cancellation testing
    const bookingStart = new Date(Date.now() + 86400000 * 3); // 3 days from now
    const bookingEnd = new Date(bookingStart.getTime() + 7200000); // 2 hours duration
    const bkg = await prisma.booking.create({
      data: {
        bookingCode: 'BKG-E2E-WORKFLOW',
        userId: testUser1Id,
        serviceName: 'E2E Consultation Service',
        category: 'Consulting',
        scheduledAt: bookingStart,
        durationHours: new Prisma.Decimal('2.00'),
        endTime: bookingEnd,
        status: BookingStatus.CONFIRMED,
        amount: new Prisma.Decimal('180.00'),
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: 'Credit Card',
        invoiceCode: `INV-E2E-${Date.now().toString().slice(-5)}`,
      },
    });
    rescheduleBookingId = bkg.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    if (refundTxnId) {
      await prisma.transactionStatusHistory.deleteMany({
        where: { transactionId: refundTxnId },
      });
      await prisma.transaction.deleteMany({
        where: { id: refundTxnId },
      });
    }
    if (rescheduleBookingId) {
      await prisma.bookingLog.deleteMany({
        where: { bookingId: rescheduleBookingId },
      });
      await prisma.booking.deleteMany({
        where: { id: rescheduleBookingId },
      });
    }
    const userIds = [testUser1Id, testUser2Id].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.activityLog.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
    await app.close();
  });

  // ==========================================================
  // SECTION 1: BULK USER OPERATIONS
  // ==========================================================
  describe('Bulk User Operations', () => {
    it('POST /api/v1/users/bulk/status - updates multiple user statuses', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users/bulk/status')
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .send({
          userCodes: [testUser1Id, testUser2Id],
          status: UserStatus.SUSPENDED,
        })
        .expect(200);

      expect(res.body.data.affectedCount).toBe(2);
      expect(res.body.data.message).toContain('SUSPENDED');
      expect(res.body.data.message).toContain('2 user(s)');

      // Verify in DB
      const u1 = await prisma.user.findUnique({ where: { id: testUser1Id } });
      expect(u1?.status).toBe(UserStatus.SUSPENDED);
    });

    it('POST /api/v1/users/bulk/role - enforces SUPER_ADMIN RBAC', async () => {
      // 1. Staff ADMIN should be forbidden (403)
      await request(app.getHttpServer())
        .post('/api/v1/users/bulk/role')
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .send({
          userCodes: [testUser1Id],
          role: UserRole.EDITOR,
        })
        .expect(403);

      // 2. Super Admin succeeds (200)
      const res = await request(app.getHttpServer())
        .post('/api/v1/users/bulk/role')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          userCodes: [testUser1Id, testUser2Id],
          role: UserRole.EDITOR,
        })
        .expect(200);

      expect(res.body.data.affectedCount).toBe(2);

      const u1 = await prisma.user.findUnique({ where: { id: testUser1Id } });
      expect(u1?.role).toBe(UserRole.EDITOR);
    });

    it('POST /api/v1/users/bulk/delete - soft deletes selected users with SUPER_ADMIN', async () => {
      // Create temporary user for delete test (userCode <= 20 chars)
      const tempCode = `USR-TD-${Date.now().toString().slice(-6)}`;
      const tempUser = await prisma.user.create({
        data: {
          userCode: tempCode,
          firstName: 'Temp',
          lastName: 'Delete',
          email: `td.${Date.now()}@example.com`,
          phone: '+1 555-010-0003',
          role: UserRole.VIEWER,
          status: UserStatus.ACTIVE,
        },
      });

      // Staff ADMIN should be forbidden (403)
      await request(app.getHttpServer())
        .post('/api/v1/users/bulk/delete')
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .send({ userCodes: [tempUser.id] })
        .expect(403);

      // Super admin succeeds (200)
      const res = await request(app.getHttpServer())
        .post('/api/v1/users/bulk/delete')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ userCodes: [tempUser.id] })
        .expect(200);

      expect(res.body.data.affectedCount).toBe(1);

      const deleted = await prisma.user.findUnique({ where: { id: tempUser.id } });
      expect(deleted?.deletedAt).not.toBeNull();

      // Clean up temp record permanently
      await prisma.user.delete({ where: { id: tempUser.id } });
    });
  });

  // ==========================================================
  // SECTION 2: RFC 4180 DATA EXPORTS
  // ==========================================================
  describe('RFC 4180 CSV Data Exports', () => {
    it('GET /api/v1/users/export - exports user directory in raw CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/export')
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename="users_export_');
      expect(res.headers['content-disposition']).toContain('.csv"');
      expect(res.text).toContain('User Code,Name,Email,Phone,Role,Status');
      expect(res.text).toContain('bulk.e2e1@example.com');
    });

    it('GET /api/v1/transactions/export - exports transactions in raw CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions/export')
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename="transactions_export_');
      expect(res.headers['content-disposition']).toContain('.csv"');
      expect(res.text).toContain('Transaction Code,Reference,Customer Name');
      expect(res.text).toContain('TXN-E2E-REFUND');
    });

    it('GET /api/v1/bookings/export - exports bookings in raw CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings/export')
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename="bookings_export_');
      expect(res.headers['content-disposition']).toContain('.csv"');
      expect(res.text).toContain('Booking Code,Invoice Code,Customer Name');
      expect(res.text).toContain('BKG-E2E-WORKFLOW');
    });

    it('GET /api/v1/dashboard/reports/export - exports monthly reports with totals in raw CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/reports/export')
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename="monthly_reports_export_');
      expect(res.headers['content-disposition']).toContain('.csv"');
      expect(res.text).toContain('Month,Orders,Revenue ($),Avg / Order ($),Growth MoM (%)');
      expect(res.text).toContain('Total / Summary');
    });
  });

  // ==========================================================
  // SECTION 3: TRANSACTION REFUND WORKFLOW
  // ==========================================================
  describe('Transaction Refund Workflow', () => {
    it('POST /api/v1/transactions/:id/refund - processes refund on completed transaction', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/transactions/${refundTxnId}/refund`)
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .send({ reason: 'Customer cancelled order before shipping' })
        .expect(200);

      expect(res.body.data.status).toBe(TransactionStatus.REFUNDED);
      expect(res.body.data.id).toBe(refundTxnId);

      // Verify audit history was appended
      const history = await prisma.transactionStatusHistory.findMany({
        where: { transactionId: refundTxnId },
      });
      expect(history.some((h) => h.status === TransactionStatus.REFUNDED)).toBe(true);
    });

    it('POST /api/v1/transactions/:id/refund - rejects double refund with 400', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/transactions/${refundTxnId}/refund`)
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .send({ reason: 'Another refund attempt' })
        .expect(400);

      expect(res.body.message).toContain('already refunded');
    });
  });

  // ==========================================================
  // SECTION 4: BOOKING LIFECYCLE WORKFLOWS (RESCHEDULE & CANCEL)
  // ==========================================================
  describe('Booking Lifecycle Workflows', () => {
    it('POST /api/v1/bookings/:id/reschedule - reschedules booking to future timestamp', async () => {
      const newFutureDate = new Date(Date.now() + 86400000 * 10).toISOString();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${rescheduleBookingId}/reschedule`)
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .send({
          scheduledAt: newFutureDate,
          note: 'Customer requested a schedule change to 10 days out',
        })
        .expect(200);

      expect(new Date(res.body.data.scheduledAt).toISOString()).toBe(newFutureDate);

      // Verify booking log was created
      const logs = await prisma.bookingLog.findMany({
        where: { bookingId: rescheduleBookingId },
      });
      expect(logs.some((l) => l.event === 'Booking Rescheduled')).toBe(true);
    });

    it('POST /api/v1/bookings/:id/reschedule - rejects past timestamp with 400', async () => {
      const pastDate = new Date('2020-01-01T10:00:00.000Z').toISOString();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${rescheduleBookingId}/reschedule`)
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .send({
          scheduledAt: pastDate,
        })
        .expect(400);

      expect(res.body.message).toContain('future');
    });

    it('POST /api/v1/bookings/:id/cancel - cancels booking and appends audit log', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${rescheduleBookingId}/cancel`)
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .send({ reason: 'Customer requested cancellation due to weather' })
        .expect(200);

      expect(res.body.data.status).toBe(BookingStatus.CANCELLED);

      // Verify DB status
      const updated = await prisma.booking.findUnique({
        where: { id: rescheduleBookingId },
      });
      expect(updated?.status).toBe(BookingStatus.CANCELLED);
    });

    it('POST /api/v1/bookings/:id/cancel - rejects re-cancelling already cancelled booking', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${rescheduleBookingId}/cancel`)
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .send({ reason: 'Second cancellation' })
        .expect(400);

      expect(res.body.message).toContain('already cancelled');
    });

    it('POST /api/v1/bookings/:id/reschedule - rejects rescheduling a cancelled booking', async () => {
      const newFutureDate = new Date(Date.now() + 86400000 * 12).toISOString();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${rescheduleBookingId}/reschedule`)
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .send({ scheduledAt: newFutureDate })
        .expect(400);

      expect(res.body.message).toContain('cancelled');
    });
  });

  // ==========================================================
  // SECTION 5: UNIFIED CROSS-ENTITY OMNI-SEARCH
  // ==========================================================
  describe('Unified Omni-Search', () => {
    it('GET /api/v1/search?q=Sarah - returns matched users, transactions, and bookings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/search?q=Sarah')
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .expect(200);

      expect(res.body.data.query).toBe('Sarah');
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(Array.isArray(res.body.data.transactions)).toBe(true);
      expect(Array.isArray(res.body.data.bookings)).toBe(true);
      expect(typeof res.body.data.totalMatches).toBe('number');
      expect(res.body.data.totalMatches).toBeGreaterThan(0);
    });

    it('GET /api/v1/search?q= - validates empty query with 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/search?q=')
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .expect(400);
    });

    it('GET /api/v1/search - validates missing query with 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/search')
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .expect(400);
    });

    it('GET /api/v1/search?q=NONEXISTENT_XYZ_99999 - returns zero matches gracefully', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/search?q=NONEXISTENT_XYZ_99999')
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .expect(200);

      expect(res.body.data.users).toEqual([]);
      expect(res.body.data.transactions).toEqual([]);
      expect(res.body.data.bookings).toEqual([]);
      expect(res.body.data.totalMatches).toBe(0);
    });
  });
});
