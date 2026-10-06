import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Dashboard Module (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let adminToken: string;
  let sampleAlertId: string;

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

    const admin = await prisma.admin.findUnique({
      where: { email: 'admin@miles.io' },
    });

    if (!admin) {
      throw new Error('Seeded admin not found in test database');
    }

    adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });

    // Ensure a sample alert exists for testing alert endpoints
    const alert = await prisma.alert.findFirst({
      where: { isResolved: false },
    });

    if (alert) {
      sampleAlertId = alert.id;
    } else {
      const createdAlert = await prisma.alert.create({
        data: {
          title: 'Test Server Alert',
          description: 'High memory usage on node',
          severity: 'WARNING',
          isResolved: false,
        },
      });
      sampleAlertId = createdAlert.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Enforcement', () => {
    it('should reject unauthenticated request to GET /api/v1/dashboard/stats with 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/dashboard/stats',
      );
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated request to GET /api/v1/dashboard/charts with 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/dashboard/charts',
      );
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated request to GET /api/v1/dashboard/alerts with 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/dashboard/alerts',
      );
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated request to GET /api/v1/dashboard/health with 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/dashboard/health',
      );
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated request to GET /api/v1/dashboard/overview with 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/dashboard/overview',
      );
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/dashboard/stats (KPI Cards & Totals)', () => {
    it('should return 200 with 4 primary KPI cards and system totals', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const { kpis, totals } = res.body.data;
      expect(Array.isArray(kpis)).toBe(true);
      expect(kpis).toHaveLength(4);

      const kpiIds = kpis.map((k: { id: string }) => k.id);
      expect(kpiIds).toEqual(
        expect.arrayContaining(['users', 'revenue', 'bookings', 'pending']),
      );

      for (const kpi of kpis) {
        expect(typeof kpi.label).toBe('string');
        expect(typeof kpi.value).toBe('number');
        expect(['currency', 'fullCurrency', 'number', 'percent']).toContain(
          kpi.format,
        );
        expect(['up', 'down', 'flat']).toContain(kpi.trend);
        expect(typeof kpi.hint).toBe('string');
      }

      // Verify totals object
      expect(totals).toBeDefined();
      expect(typeof totals.revenue).toBe('number');
      expect(typeof totals.pendingRevenue).toBe('number');
      expect(typeof totals.orders).toBe('number');
      expect(typeof totals.paidOrders).toBe('number');
      expect(typeof totals.users).toBe('number');
      expect(typeof totals.bookings).toBe('number');
      expect(typeof totals.averageOrderValue).toBe('number');
      expect(typeof totals.bookingSuccessRate).toBe('number');
      expect(totals.bookingSuccessRate).toBeGreaterThanOrEqual(0);
      expect(totals.bookingSuccessRate).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/v1/dashboard/charts (Time-Series & Breakdowns)', () => {
    it('should return 6-month historical series and categorical charts by default', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/charts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.range).toBe('6m');
      expect(data.revenueByPeriod).toHaveLength(6);
      expect(data.revenueByMonth).toHaveLength(6);

      // Verify zero-filled structure of revenue points
      for (const point of data.revenueByPeriod) {
        expect(typeof point.period).toBe('string');
        expect(typeof point.revenue).toBe('number');
        expect(typeof point.orders).toBe('number');
      }

      // Verify ordersByStatus distribution
      expect(data.ordersByStatus).toHaveLength(4);
      const orderStatuses = data.ordersByStatus.map(
        (s: { status: string }) => s.status,
      );
      expect(orderStatuses).toEqual(
        expect.arrayContaining(['COMPLETED', 'PENDING', 'FAILED', 'REFUNDED']),
      );

      // Verify bookingsByStatus distribution
      expect(data.bookingsByStatus).toHaveLength(4);
      const bkgStatuses = data.bookingsByStatus.map(
        (s: { status: string }) => s.status,
      );
      expect(bkgStatuses).toEqual(
        expect.arrayContaining([
          'CONFIRMED',
          'PENDING',
          'COMPLETED',
          'CANCELLED',
        ]),
      );

      // Verify bookingsByCategory
      expect(Array.isArray(data.bookingsByCategory)).toBe(true);

      // Verify topProducts
      expect(Array.isArray(data.topProducts)).toBe(true);
      if (data.topProducts.length > 0) {
        const prod = data.topProducts[0];
        expect(typeof prod.title).toBe('string');
        expect(typeof prod.unitsSold).toBe('number');
        expect(typeof prod.revenue).toBe('number');
      }
    });

    it('should support 7d range parameter with 7 continuous daily points', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/charts?range=7d')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.range).toBe('7d');
      expect(res.body.data.revenueByPeriod).toHaveLength(7);
    });

    it('should support 1y range parameter with 12 monthly points', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/charts?range=1y')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.range).toBe('1y');
      expect(res.body.data.revenueByPeriod).toHaveLength(12);
    });

    it('should reject invalid range parameter with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/charts?range=99y')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/dashboard/alerts & PATCH /resolve', () => {
    it('should retrieve list of active system operational alerts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/alerts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const alert = res.body.data[0];
      expect(alert.id).toBeDefined();
      expect(alert.title).toBeDefined();
      expect(['danger', 'warning', 'info']).toContain(alert.tone);
      expect(alert.isResolved).toBe(false);
      expect(typeof alert.time).toBe('string');
    });

    it('should resolve an operational alert by UUID', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/dashboard/alerts/${sampleAlertId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(sampleAlertId);
      expect(res.body.data.isResolved).toBe(true);

      // Verify direct database persistence
      const dbAlert = await prisma.alert.findUnique({
        where: { id: sampleAlertId },
      });
      expect(dbAlert?.isResolved).toBe(true);
    });

    it('should return 404 when attempting to resolve a non-existent alert UUID', async () => {
      const missingUuid = '999e4567-e89b-12d3-a456-426614174999';
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/dashboard/alerts/${missingUuid}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 when alert ID is not a valid UUID', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/dashboard/alerts/not-a-valid-uuid/resolve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/dashboard/health (Infrastructure Metrics)', () => {
    it('should return system uptime, database connected status, and active sessions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.uptime).toMatch(/\d+(\.\d+)?%/);
      expect(data.database).toBe('connected');
      expect(data.avgResponseTime).toMatch(/\d+ms/);
      expect(typeof data.activeSessions).toBe('number');
      expect(data.activeSessions).toBeGreaterThan(0);
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('GET /api/v1/dashboard/recent-transactions & upcoming-bookings', () => {
    it('should retrieve latest transactions respecting limit query parameter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/recent-transactions?limit=3')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(3);

      if (res.body.data.length > 0) {
        const txn = res.body.data[0];
        expect(txn.txnCode).toMatch(/^TXN-\d{4,}$/);
        expect(txn.customerName).toBeDefined();
        expect(typeof txn.amount).toBe('number');
        expect(typeof txn.subtotal).toBe('number');
        expect(typeof txn.total).toBe('number');
      }
    });

    it('should retrieve upcoming bookings respecting limit query parameter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/upcoming-bookings?limit=4')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(4);

      if (res.body.data.length > 0) {
        const bkg = res.body.data[0];
        expect(bkg.bookingCode).toMatch(/^BKG-\d{4,}$/);
        expect(bkg.customerName).toBeDefined();
        expect(bkg.serviceName).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/dashboard/overview (Consolidated Payload)', () => {
    it('should return complete consolidated dashboard overview in a single roundtrip', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/overview?range=6m')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.stats).toBeDefined();
      expect(data.stats.kpis).toHaveLength(4);
      expect(data.stats.totals).toBeDefined();

      expect(data.charts).toBeDefined();
      expect(data.charts.revenueByPeriod).toHaveLength(6);
      expect(data.charts.ordersByStatus).toBeDefined();
      expect(data.charts.bookingsByStatus).toBeDefined();

      expect(data.alerts).toBeDefined();
      expect(Array.isArray(data.alerts)).toBe(true);

      expect(data.health).toBeDefined();
      expect(data.health.database).toBe('connected');

      expect(data.recentTransactions).toBeDefined();
      expect(Array.isArray(data.recentTransactions)).toBe(true);

      expect(data.upcomingBookings).toBeDefined();
      expect(Array.isArray(data.upcomingBookings)).toBe(true);
    });
  });

  describe('GET /api/v1/dashboard/reports (Monthly Reports)', () => {
    it('should return 12-month historical reporting table rows and summary totals', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.rows).toBeDefined();
      expect(data.rows).toHaveLength(12);
      expect(data.totals).toBeDefined();
      expect(typeof data.totals.totalOrders).toBe('number');
      expect(typeof data.totals.totalRevenue).toBe('number');
      expect(typeof data.totals.overallAverageOrderValue).toBe('number');
      expect(typeof data.totals.averageMonthlyRevenue).toBe('number');

      // Validate structure of a row
      const firstRow = data.rows[0];
      expect(firstRow.month).toBeDefined();
      expect(typeof firstRow.orders).toBe('number');
      expect(typeof firstRow.revenue).toBe('number');
      expect(typeof firstRow.averageOrderValue).toBe('number');
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/dashboard/reports',
      );

      expect(res.status).toBe(401);
    });
  });
});
