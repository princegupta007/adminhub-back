import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TransactionStatus, TransactionType } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Transactions Module (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let adminToken: string;
  let adminId: string;
  let customerUserId: string;
  let sampleTxnCode: string;
  let sampleTxnId: string;

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
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'api/v1/health'],
    });

    await app.init();
    jwtService = moduleFixture.get<JwtService>(JwtService);
    prisma = moduleFixture.get(PrismaService);

    // Resolve seeded admin
    const admin = await prisma.admin.findUnique({
      where: { email: 'admin@miles.io' },
    });

    if (!admin) {
      throw new Error('Seeded admin not found in test database');
    }

    adminId = admin.id;
    adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });

    // Resolve a seeded customer user
    const user = await prisma.user.findFirst({
      where: { deletedAt: null },
    });

    if (!user) {
      throw new Error('No active customer users found in test database');
    }
    customerUserId = user.id;

    // Resolve an existing seeded transaction
    const existingTxn = await prisma.transaction.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!existingTxn) {
      throw new Error('No seeded transactions found in test database');
    }

    sampleTxnCode = existingTxn.txnCode;
    sampleTxnId = existingTxn.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Enforcement', () => {
    it('should reject unauthenticated request to GET /api/v1/transactions with 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/transactions',
      );
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated request to GET /api/v1/transactions/stats with 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/transactions/stats',
      );
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated request to POST /api/v1/transactions with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .send({});
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/transactions (Listing & Pagination)', () => {
    it('should return 200 with paginated transactions and valid envelope', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(10);
      expect(res.body.meta).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 10,
          total: expect.any(Number),
          totalPages: expect.any(Number),
        }),
      );

      // Verify fields of summary item
      const item = res.body.data[0];
      expect(item).toHaveProperty('txnCode');
      expect(item).toHaveProperty('customerName');
      expect(item).toHaveProperty('amount');
      expect(typeof item.amount).toBe('number');
      expect(item).toHaveProperty('gatewayFee');
      expect(typeof item.gatewayFee).toBe('number');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('type');
    });

    it('should support custom pagination limit and page offset', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions?page=2&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.meta.page).toBe(2);
      expect(res.body.meta.limit).toBe(5);
    });

    it('should filter transactions by search term across txnCode and customer name', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/transactions?q=${sampleTxnCode}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].txnCode).toBe(sampleTxnCode);
    });

    it('should support search alias "search" parameter', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/transactions?search=${sampleTxnCode}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].txnCode).toBe(sampleTxnCode);
    });

    it('should filter by transaction status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions?status=COMPLETED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const item of res.body.data) {
        expect(item.status).toBe('COMPLETED');
      }
    });

    it('should normalize frontend status alias "paid" to COMPLETED', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions?status=paid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        expect(item.status).toBe('COMPLETED');
      }
    });

    it('should filter by transaction type', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions?type=PAYMENT')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        expect(item.type).toBe('PAYMENT');
      }
    });

    it('should filter by date preset "30" (last 30 days)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions?date=30')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const thirtyDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      for (const item of res.body.data) {
        expect(new Date(item.createdAt).getTime()).toBeGreaterThanOrEqual(
          thirtyDaysAgo.getTime(),
        );
      }
    });

    it('should reject invalid date range where dateFrom > dateTo with 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions?dateFrom=2026-10-15&dateTo=2026-10-01')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should support ascending sort by amount', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions?sortBy=amount&sortOrder=asc&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const amounts = res.body.data.map((t: any) => t.amount);
      for (let i = 1; i < amounts.length; i++) {
        expect(amounts[i]).toBeGreaterThanOrEqual(amounts[i - 1]);
      }
    });
  });

  describe('GET /api/v1/transactions/stats', () => {
    it('should return calculated overview statistics with Decimal accuracy', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          revenue: expect.any(Number),
          avg: expect.any(Number),
          pendingCount: expect.any(Number),
          successRate: expect.any(Number),
          completedCount: expect.any(Number),
          failedCount: expect.any(Number),
          refundedCount: expect.any(Number),
        }),
      );
      expect(res.body.data.total).toBeGreaterThan(0);
      expect(res.body.data.revenue).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/transactions/:id (Detail View)', () => {
    it('should retrieve full transaction detail by business code (TXN-XXXX)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/transactions/${sampleTxnCode}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.txnCode).toBe(sampleTxnCode);
      expect(res.body.data).toHaveProperty('customer');
      expect(res.body.data.customer).toHaveProperty('name');
      expect(res.body.data.customer).toHaveProperty('email');
      expect(res.body.data).toHaveProperty('statusHistory');
      expect(Array.isArray(res.body.data.statusHistory)).toBe(true);
      expect(res.body.data).toHaveProperty('relatedLedger');
      expect(Array.isArray(res.body.data.relatedLedger)).toBe(true);
    });

    it('should retrieve transaction detail by UUID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/transactions/${sampleTxnId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(sampleTxnId);
      expect(res.body.data.txnCode).toBe(sampleTxnCode);
    });

    it('should return 404 when transaction is not found', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions/TXN-99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/transactions (Creation)', () => {
    it('should reject creation with missing required fields with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 100 });

      expect(res.status).toBe(400);
    });

    it('should return 404 when userId refers to nonexistent user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: '00000000-0000-0000-0000-000000000000',
          amount: 250.0,
          productName: 'Emergency Repair',
          paymentMethod: 'Credit Card (Visa)',
        });

      expect(res.status).toBe(404);
    });

    it('should create transaction with atomic code, fee calculation, and audit history', async () => {
      const uniqueRef = `ref_e2e_${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: customerUserId,
          type: TransactionType.PAYMENT,
          status: TransactionStatus.PENDING,
          amount: 500.0,
          currency: 'USD',
          productName: 'Smart Lock Setup',
          paymentMethod: 'Mastercard ending in 2041',
          reference: uniqueRef,
        });

      expect(res.status).toBe(201);
      const created = res.body.data;
      expect(created.txnCode).toMatch(/^TXN-\d{4,}$/);
      expect(created.reference).toBe(uniqueRef);
      expect(created.amount).toBe(500.0);
      expect(created.gatewayFee).toBe(14.5); // 500 * 0.029
      expect(created.subtotal).toBe(485.5); // 500 - 14.50
      expect(created.status).toBe('PENDING');

      // Verify activity log created
      const activity = await prisma.activityLog.findFirst({
        where: {
          userId: customerUserId,
          action: 'TRANSACTION_CREATED',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(activity).not.toBeNull();
      expect(activity?.description).toContain(created.txnCode);

      // Verify status history log created
      const history = await prisma.transactionStatusHistory.findFirst({
        where: { transactionId: created.id },
      });
      expect(history).not.toBeNull();
      expect(history?.status).toBe('PENDING');
      expect(history?.adminId).toBe(adminId);
    });

    it('should reject creation with duplicate reference with 409 Conflict', async () => {
      const duplicateRef = `ref_dup_${Date.now()}`;

      // First creation
      await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: customerUserId,
          amount: 100.0,
          productName: 'Duplicate Test',
          paymentMethod: 'PayPal',
          reference: duplicateRef,
        });

      // Second creation with identical reference
      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: customerUserId,
          amount: 150.0,
          productName: 'Duplicate Test 2',
          paymentMethod: 'PayPal',
          reference: duplicateRef,
        });

      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/v1/transactions/:id/status (Lifecycle Transitions)', () => {
    let pendingTxnCode: string;

    beforeAll(async () => {
      // Create a dedicated PENDING transaction for status transition testing
      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: customerUserId,
          amount: 320.0,
          productName: 'Lifecycle Test Item',
          paymentMethod: 'Visa Card',
          status: TransactionStatus.PENDING,
        });
      pendingTxnCode = res.body.data.txnCode;
    });

    it('should transition PENDING transaction to COMPLETED and set settledAt', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/transactions/${pendingTxnCode}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: TransactionStatus.COMPLETED,
          note: 'Bank wire settlement verified',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.settledAt).not.toBeNull();

      // Check status history entry was appended
      const latestHistory = res.body.data.statusHistory[0];
      expect(latestHistory.status).toBe('COMPLETED');
      expect(latestHistory.note).toBe('Bank wire settlement verified');
      expect(latestHistory.adminId).toBe(adminId);
    });

    it('should transition COMPLETED transaction to REFUNDED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/transactions/${pendingTxnCode}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: TransactionStatus.REFUNDED,
          note: 'Customer requested refund after cancellation',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REFUNDED');
    });

    it('should reject invalid transition from terminal REFUNDED status with 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/transactions/${pendingTxnCode}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: TransactionStatus.COMPLETED,
          note: 'Attempting invalid un-refund',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        'Invalid transaction status transition',
      );
    });
  });

  describe('Concurrency Safety Verification', () => {
    it('should safely generate distinct sequential transaction codes under concurrent creation', async () => {
      const concurrentRequests = 5;
      const promises = Array.from({ length: concurrentRequests }).map((_, i) =>
        request(app.getHttpServer())
          .post('/api/v1/transactions')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            userId: customerUserId,
            amount: 50.0 + i * 10,
            productName: `Concurrent Item #${i + 1}`,
            paymentMethod: 'Credit Card',
          }),
      );

      const responses = await Promise.all(promises);

      // Verify every request succeeded with 201 Created
      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      // Collect all generated codes
      const generatedCodes = responses.map((r) => r.body.data.txnCode);
      const uniqueCodes = new Set(generatedCodes);

      // Verify zero duplicates
      expect(uniqueCodes.size).toBe(concurrentRequests);
      for (const code of generatedCodes) {
        expect(code).toMatch(/^TXN-\d{4,}$/);
      }
    });
  });
});
