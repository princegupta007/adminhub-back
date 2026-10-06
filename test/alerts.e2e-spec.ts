import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AdminRole, AlertSeverity } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Alerts & Notifications Module (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let superAdminToken: string;
  let standardAdminToken: string;
  let standardAdminId: string;
  let createdAlertId: string;
  let batchAlertId1: string;
  let batchAlertId2: string;

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

    const superAdmin = await prisma.admin.findUnique({
      where: { email: 'admin@miles.io' },
    });

    if (!superAdmin) {
      throw new Error('Seeded super admin not found in test database');
    }

    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      email: superAdmin.email,
      role: AdminRole.SUPER_ADMIN,
    });

    // Ensure a standard admin exists in DB for RBAC testing
    let standardAdmin = await prisma.admin.findFirst({
      where: { role: AdminRole.ADMIN },
    });

    if (!standardAdmin) {
      standardAdmin = await prisma.admin.create({
        data: {
          email: 'standard.admin@miles.io',
          name: 'Standard Admin',
          passwordHash: 'dummy-password-hash',
          role: AdminRole.ADMIN,
        },
      });
      standardAdminId = standardAdmin.id;
    } else {
      standardAdminId = standardAdmin.id;
    }

    standardAdminToken = jwtService.sign({
      sub: standardAdmin.id,
      email: standardAdmin.email,
      role: AdminRole.ADMIN,
    });

    // Seed test alerts for predictable E2E tests
    const alert1 = await prisma.alert.create({
      data: {
        title: 'E2E Batch Alert Alpha',
        description: 'First batch testing alert incident',
        severity: AlertSeverity.WARNING,
        isResolved: false,
      },
    });
    batchAlertId1 = alert1.id;

    const alert2 = await prisma.alert.create({
      data: {
        title: 'E2E Batch Alert Beta',
        description: 'Second batch testing alert incident',
        severity: AlertSeverity.INFO,
        isResolved: false,
      },
    });
    batchAlertId2 = alert2.id;
  });

  afterAll(async () => {
    // Cleanup any created test alerts
    const testIds = [createdAlertId, batchAlertId1, batchAlertId2].filter(
      Boolean,
    );
    if (testIds.length > 0) {
      await prisma.alert.deleteMany({
        where: { id: { in: testIds } },
      });
    }

    // Cleanup standard admin if created specifically for this test
    if (standardAdminId) {
      const admin = await prisma.admin.findUnique({
        where: { id: standardAdminId },
      });
      if (admin && admin.email === 'standard.admin@miles.io') {
        await prisma.admin.delete({ where: { id: standardAdminId } });
      }
    }

    await app.close();
  });

  describe('Authentication & Security', () => {
    it('should reject unauthenticated request to /api/v1/alerts with 401', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/alerts');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject request with invalid JWT token with 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/alerts')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/alerts', () => {
    it('should return paginated list of alerts with default envelope', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/alerts')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(10);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(2);

      if (response.body.data.length > 0) {
        const item = response.body.data[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('severity');
        expect(item).toHaveProperty('tone');
        expect(item).toHaveProperty('isResolved');
        expect(item).toHaveProperty('time');
        expect(item).toHaveProperty('createdAt');
      }
    });

    it('should filter alerts by search keyword', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/alerts?search=Batch%20Alert%20Alpha')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].title).toContain('Batch Alert Alpha');
    });

    it('should filter alerts by severity', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/alerts?severity=WARNING')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      for (const alert of response.body.data) {
        expect(alert.severity).toBe('WARNING');
        expect(alert.tone).toBe('warning');
      }
    });

    it('should filter alerts by resolution status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/alerts?isResolved=false')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      for (const alert of response.body.data) {
        expect(alert.isResolved).toBe(false);
      }
    });

    it('should sort alerts by title ascending', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/alerts?sortBy=title&order=asc&limit=10')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      const titles = response.body.data.map((a: any) => a.title);
      const sortedTitles = [...titles].sort((a, b) => a.localeCompare(b));
      expect(titles).toEqual(sortedTitles);
    });
  });

  describe('GET /api/v1/alerts/stats', () => {
    it('should return system alert statistics with correct counts', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/alerts/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      const stats = response.body.data;
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('resolved');
      expect(stats).toHaveProperty('critical');
      expect(stats).toHaveProperty('warning');
      expect(stats).toHaveProperty('info');
      expect(typeof stats.total).toBe('number');
      expect(stats.total).toBe(stats.active + stats.resolved);
    });
  });

  describe('GET /api/v1/alerts/notifications-feed', () => {
    it('should return formatted notifications feed matching topbar UI requirements', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/alerts/notifications-feed?limit=5')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      const feed = response.body.data;
      expect(feed).toHaveProperty('unreadCount');
      expect(feed).toHaveProperty('notifications');
      expect(typeof feed.unreadCount).toBe('number');
      expect(Array.isArray(feed.notifications)).toBe(true);

      if (feed.notifications.length > 0) {
        const item = feed.notifications[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('body');
        expect(item).toHaveProperty('tone');
        expect(item).toHaveProperty('severity');
        expect(item).toHaveProperty('time');
        expect(item).toHaveProperty('unread');
      }
    });
  });

  describe('POST /api/v1/alerts (Create Alert)', () => {
    it('should reject creation with missing title with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          description: 'Valid description without title',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Title must be at least 3 characters long'),
        ]),
      );
    });

    it('should reject creation with invalid severity with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Valid Title',
          description: 'Valid Description',
          severity: 'EXTREME',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Severity must be one of'),
        ]),
      );
    });

    it('should create new alert and return mapped DTO with 201', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/alerts')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Database Failover Scheduled',
          description: 'Primary replica failover scheduled for Sunday morning',
          severity: 'CRITICAL',
        });

      expect(response.status).toBe(201);
      const alert = response.body.data;
      expect(alert).toHaveProperty('id');
      expect(alert.title).toBe('Database Failover Scheduled');
      expect(alert.description).toBe(
        'Primary replica failover scheduled for Sunday morning',
      );
      expect(alert.severity).toBe('CRITICAL');
      expect(alert.tone).toBe('danger');
      expect(alert.isResolved).toBe(false);

      createdAlertId = alert.id;
    });
  });

  describe('GET /api/v1/alerts/:id', () => {
    it('should retrieve existing alert by UUID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/alerts/${createdAlertId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(createdAlertId);
      expect(response.body.data.title).toBe('Database Failover Scheduled');
    });

    it('should return 400 when ID is not a valid UUID', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/alerts/not-a-uuid')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Validation failed');
    });

    it('should return 404 when alert does not exist', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app.getHttpServer())
        .get(`/api/v1/alerts/${nonExistentId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('PATCH /api/v1/alerts/:id', () => {
    it('should partially update alert title and severity', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/alerts/${createdAlertId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Database Failover Completed',
          severity: 'INFO',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.title).toBe('Database Failover Completed');
      expect(response.body.data.severity).toBe('INFO');
      expect(response.body.data.tone).toBe('info');
    });

    it('should return 404 when updating non-existent alert', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/alerts/${nonExistentId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/alerts/:id/resolve', () => {
    it('should resolve alert and update isResolved to true', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/alerts/${createdAlertId}/resolve`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(createdAlertId);
      expect(response.body.data.isResolved).toBe(true);
      expect(response.body.data.message).toBe('Alert marked as resolved');
    });
  });

  describe('PATCH /api/v1/alerts/batch-resolve', () => {
    it('should reject batch-resolve when ids array is empty', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/alerts/batch-resolve')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ ids: [] });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('ids array cannot be empty'),
        ]),
      );
    });

    it('should batch resolve multiple alerts', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/alerts/batch-resolve')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ ids: [batchAlertId1, batchAlertId2] });

      expect(response.status).toBe(200);
      expect(response.body.data.resolvedCount).toBe(2);
      expect(response.body.data.ids).toEqual([batchAlertId1, batchAlertId2]);
    });
  });

  describe('PATCH /api/v1/alerts/resolve-all', () => {
    it('should resolve all active alerts and return count', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/alerts/resolve-all')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('resolvedCount');
      expect(response.body.data.message).toBe(
        'All active alerts marked as resolved',
      );
    });
  });

  describe('DELETE /api/v1/alerts/:id & Role-Based Access Control', () => {
    it('should reject delete attempt by non-SUPER_ADMIN with 403 Forbidden', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/alerts/${createdAlertId}`)
        .set('Authorization', `Bearer ${standardAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Insufficient role permissions');
    });

    it('should allow SUPER_ADMIN to delete alert successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/alerts/${createdAlertId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(createdAlertId);
      expect(response.body.data.message).toBe('Alert deleted successfully');

      // Verify deletion in database
      const checkResponse = await request(app.getHttpServer())
        .get(`/api/v1/alerts/${createdAlertId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(checkResponse.status).toBe(404);
    });
  });
});
