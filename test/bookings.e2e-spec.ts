import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { BookingStatus, PaymentStatus, UserRole } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Bookings Module (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let adminToken: string;
  let adminId: string;
  let customerUser1Id: string;
  let customerUser2Id: string;
  let sampleBookingCode: string;
  let sampleBookingId: string;

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

    // Create dedicated test customers for creation and concurrency tests to prevent time overlap collisions
    const user1 = await prisma.user.create({
      data: {
        userCode: `TB1-${Date.now().toString().slice(-4)}`,
        email: `test.bkg.create.${Date.now()}@test.io`,
        firstName: 'Test',
        lastName: 'Creator',
        phone: '+1-555-0191',
        role: UserRole.VIEWER,
        status: 'ACTIVE',
      },
    });
    const user2 = await prisma.user.create({
      data: {
        userCode: `TB2-${Date.now().toString().slice(-4)}`,
        email: `test.bkg.conc.${Date.now()}@test.io`,
        firstName: 'Test',
        lastName: 'Concurrency',
        phone: '+1-555-0192',
        role: UserRole.VIEWER,
        status: 'ACTIVE',
      },
    });

    customerUser1Id = user1.id;
    customerUser2Id = user2.id;

    // Resolve an existing seeded booking
    const existingBkg = await prisma.booking.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!existingBkg) {
      throw new Error('No seeded bookings found in test database');
    }

    sampleBookingCode = existingBkg.bookingCode;
    sampleBookingId = existingBkg.id;
  });

  afterAll(async () => {
    // Clean up created test customers and their bookings
    const userIds = [customerUser1Id, customerUser2Id].filter(Boolean);
    if (userIds.length > 0) {
      const createdBookings = await prisma.booking.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      const bkgIds = createdBookings.map((b) => b.id);
      if (bkgIds.length > 0) {
        await prisma.bookingLog.deleteMany({
          where: { bookingId: { in: bkgIds } },
        });
        await prisma.booking.deleteMany({ where: { id: { in: bkgIds } } });
      }
      await prisma.activityLog.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app.close();
  });

  describe('Authentication Enforcement', () => {
    it('should reject unauthenticated request to GET /api/v1/bookings with 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/bookings');
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated request to GET /api/v1/bookings/stats with 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/bookings/stats',
      );
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated request to POST /api/v1/bookings with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .send({});
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/bookings (Listing & Filtering)', () => {
    it('should return 200 with paginated bookings and valid response envelope', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings')
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
      expect(item).toHaveProperty('bookingCode');
      expect(item).toHaveProperty('customerName');
      expect(item).toHaveProperty('serviceName');
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('scheduledAt');
      expect(item).toHaveProperty('durationHours');
      expect(typeof item.durationHours).toBe('number');
      expect(item).toHaveProperty('endTime');
      expect(item).toHaveProperty('amount');
      expect(typeof item.amount).toBe('number');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('invoiceCode');
    });

    it('should support custom pagination page offset and limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings?page=2&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.meta.page).toBe(2);
      expect(res.body.meta.limit).toBe(5);
    });

    it('should filter bookings by search term across bookingCode and service', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings?q=${sampleBookingCode}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].bookingCode).toBe(sampleBookingCode);
    });

    it('should support search alias "search" parameter', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings?search=${sampleBookingCode}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].bookingCode).toBe(sampleBookingCode);
    });

    it('should filter by booking status (CONFIRMED)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings?status=CONFIRMED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        expect(item.status).toBe('CONFIRMED');
      }
    });

    it('should filter by temporal when: "upcoming"', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings?when=upcoming')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const nowMs = Date.now();
      for (const item of res.body.data) {
        expect(new Date(item.scheduledAt).getTime()).toBeGreaterThanOrEqual(
          nowMs - 5000,
        );
      }
    });

    it('should filter by category substring', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings?category=Cleaning')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        expect(item.category.toLowerCase()).toContain('cleaning');
      }
    });

    it('should reject invalid date range where dateFrom > dateTo with 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings?dateFrom=2026-10-25&dateTo=2026-10-01')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('should support sorting by amount ascending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings?sortBy=amount&sortOrder=asc&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const amounts = res.body.data.map((b: any) => b.amount);
      for (let i = 1; i < amounts.length; i++) {
        expect(amounts[i]).toBeGreaterThanOrEqual(amounts[i - 1]);
      }
    });
  });

  describe('GET /api/v1/bookings/stats', () => {
    it('should return overview statistics matching directory header metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          active: expect.any(Number),
          upcoming: expect.any(Number),
          completed: expect.any(Number),
          cancelled: expect.any(Number),
          totalRevenue: expect.any(Number),
          totalChangePct: expect.any(Number),
          activeChangePct: expect.any(Number),
          completedChangePct: expect.any(Number),
          cancelledChangePct: expect.any(Number),
        }),
      );
      expect(res.body.data.total).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/bookings/:id (Detail View)', () => {
    it('should retrieve booking details by business code (BKG-XXXX) with customer stats and lifecycle logs', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${sampleBookingCode}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const detail = res.body.data;
      expect(detail.bookingCode).toBe(sampleBookingCode);
      expect(detail).toHaveProperty('customer');
      expect(detail.customer).toHaveProperty('completedBookingsCount');
      expect(typeof detail.customer.completedBookingsCount).toBe('number');
      expect(detail).toHaveProperty('lifecycleLogs');
      expect(Array.isArray(detail.lifecycleLogs)).toBe(true);
      expect(detail.lifecycleLogs.length).toBeGreaterThan(0);
    });

    it('should retrieve booking details by UUID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${sampleBookingId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(sampleBookingId);
      expect(res.body.data.bookingCode).toBe(sampleBookingCode);
    });

    it('should return 404 when booking does not exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings/BKG-99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/bookings (Creation & Collision Detection)', () => {
    it('should reject creation with missing required fields with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 100 });

      expect(res.status).toBe(400);
    });

    it('should return 404 when target customer user does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: '00000000-0000-0000-0000-000000000000',
          serviceName: 'Deep Cleaning',
          category: 'Cleaning',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          amount: 150.0,
          paymentMethod: 'Credit Card',
        });

      expect(res.status).toBe(404);
    });

    it('should schedule booking appointment, generate codes atomically, and create audit entries', async () => {
      const scheduledAt = new Date(Date.now() + 7 * 86400000); // 7 days in future
      const durationHours = 2.0;

      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: customerUser1Id,
          serviceName: 'Smart Lock Setup & Calibration',
          category: 'Electrical',
          scheduledAt: scheduledAt.toISOString(),
          durationHours,
          amount: 179.0,
          paymentMethod: 'Credit Card (Visa)',
          customerNotes: 'Please call ahead before arrival',
          location: 'Virtual - Google Meet',
        });

      expect(res.status).toBe(201);
      const created = res.body.data;
      expect(created.bookingCode).toMatch(/^BKG-\d{4,}$/);
      expect(created.invoiceCode).toMatch(/^INV-\d{5,}$/);
      expect(created.serviceName).toBe('Smart Lock Setup & Calibration');
      expect(created.amount).toBe(179.0);
      expect(created.durationHours).toBe(2.0);

      // Verify calculated endTime invariant
      const expectedEndMs = scheduledAt.getTime() + 2 * 3600 * 1000;
      expect(new Date(created.endTime).getTime()).toBe(expectedEndMs);

      // Verify lifecycle log created
      const bkgLog = await prisma.bookingLog.findFirst({
        where: { bookingId: created.id },
      });
      expect(bkgLog).not.toBeNull();
      expect(bkgLog?.event).toBe('Booking Created');
      expect(bkgLog?.adminId).toBe(adminId);

      // Verify user activity log created
      const activity = await prisma.activityLog.findFirst({
        where: {
          userId: customerUser1Id,
          action: 'BOOKING_CREATED',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(activity).not.toBeNull();
      expect(activity?.description).toContain(created.bookingCode);
    });

    it('should reject overlapping booking creation for the same customer with 409 Conflict', async () => {
      const scheduledAt = new Date(Date.now() + 10 * 86400000); // 10 days in future

      // First booking: 10:00 to 12:00 (2 hrs)
      const firstRes = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: customerUser1Id,
          serviceName: 'HVAC Maintenance',
          category: 'Appliances',
          scheduledAt: scheduledAt.toISOString(),
          durationHours: 2.0,
          amount: 220.0,
          paymentMethod: 'Credit Card',
        });
      expect(firstRes.status).toBe(201);

      // Second booking: overlapping from 11:00 to 12:30 for SAME customer
      const overlappingScheduledAt = new Date(
        scheduledAt.getTime() + 1 * 3600 * 1000,
      ); // 1 hour into first booking
      const secondRes = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: customerUser1Id,
          serviceName: 'Plumbing Inspection',
          category: 'Plumbing',
          scheduledAt: overlappingScheduledAt.toISOString(),
          durationHours: 1.5,
          amount: 150.0,
          paymentMethod: 'Credit Card',
        });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.message).toContain('already has an active booking');
    });
  });

  describe('PATCH /api/v1/bookings/:id (Update, Reschedule & Lifecycle)', () => {
    let testBookingCode: string;

    beforeAll(async () => {
      // Create a dedicated PENDING booking for testing mutations
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: customerUser2Id,
          serviceName: 'Painting Consultation',
          category: 'Painting',
          scheduledAt: new Date(Date.now() + 14 * 86400000).toISOString(),
          durationHours: 1.0,
          amount: 85.0,
          paymentMethod: 'PayPal',
          status: BookingStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
        });
      testBookingCode = res.body.data.bookingCode;
    });

    it('should transition PENDING booking to CONFIRMED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${testBookingCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: BookingStatus.CONFIRMED,
          note: 'Assigned senior decorator',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CONFIRMED');

      // Check lifecycle log added
      const log = res.body.data.lifecycleLogs[0];
      expect(log.event).toBe('Status Set to Confirmed');
      expect(log.description).toBe('Assigned senior decorator');
    });

    it('should transition CONFIRMED booking to COMPLETED and auto-mark paymentStatus to PAID', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${testBookingCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: BookingStatus.COMPLETED,
          note: 'Consultation concluded successfully',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.paymentStatus).toBe('PAID');
    });

    it('should reject invalid transition from terminal COMPLETED status with 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${testBookingCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: BookingStatus.PENDING,
          note: 'Attempting invalid rollback',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid booking status transition');
    });
  });

  describe('Concurrency Safety Verification', () => {
    let concUserId: string;

    beforeAll(async () => {
      const concUser = await prisma.user.create({
        data: {
          userCode: `TCU-${Date.now().toString().slice(-4)}`,
          email: `test.conc.${Date.now()}@test.io`,
          firstName: 'Concurrency',
          lastName: 'Tester',
          phone: '+1-555-0999',
          role: UserRole.VIEWER,
          status: 'ACTIVE',
        },
      });
      concUserId = concUser.id;
    });

    afterAll(async () => {
      if (concUserId) {
        const bookings = await prisma.booking.findMany({
          where: { userId: concUserId },
          select: { id: true },
        });
        const bkgIds = bookings.map((b) => b.id);
        if (bkgIds.length > 0) {
          await prisma.bookingLog.deleteMany({
            where: { bookingId: { in: bkgIds } },
          });
          await prisma.booking.deleteMany({ where: { id: { in: bkgIds } } });
        }
        await prisma.activityLog.deleteMany({ where: { userId: concUserId } });
        await prisma.user.deleteMany({ where: { id: concUserId } });
      }
    });

    it('should safely generate distinct sequential booking and invoice codes under concurrent creation', async () => {
      const concurrentCount = 5;
      const baseScheduleMs = Date.now() + 30 * 86400000;

      // Each request uses a distinct future time slot to avoid time collision
      const promises = Array.from({ length: concurrentCount }).map((_, i) =>
        request(app.getHttpServer())
          .post('/api/v1/bookings')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            userId: concUserId,
            serviceName: `Concurrent Service #${i + 1}`,
            category: 'General',
            scheduledAt: new Date(
              baseScheduleMs + i * 4 * 3600 * 1000,
            ).toISOString(),
            durationHours: 1.0,
            amount: 100.0 + i * 10,
            paymentMethod: 'Credit Card',
          }),
      );

      const responses = await Promise.all(promises);

      // Verify each request succeeded with 201 Created
      for (const res of responses) {
        if (res.status !== 201) {
          console.error('Failed concurrent booking response:', res.status, JSON.stringify(res.body));
        }
        expect(res.status).toBe(201);
      }

      // Collect all generated booking and invoice codes
      const bookingCodes = responses.map((r) => r.body.data.bookingCode);
      const invoiceCodes = responses.map((r) => r.body.data.invoiceCode);

      const uniqueBookingCodes = new Set(bookingCodes);
      const uniqueInvoiceCodes = new Set(invoiceCodes);

      // Verify zero duplicate codes
      expect(uniqueBookingCodes.size).toBe(concurrentCount);
      expect(uniqueInvoiceCodes.size).toBe(concurrentCount);

      for (const bkgCode of bookingCodes) {
        expect(bkgCode).toMatch(/^BKG-\d{4,}$/);
      }
      for (const invCode of invoiceCodes) {
        expect(invCode).toMatch(/^INV-\d{5,}$/);
      }
    });
  });
});
