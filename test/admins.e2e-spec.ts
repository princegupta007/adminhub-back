import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Admin Directory & Lifecycle Management (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let superAdminToken: string;
  let staffToken: string;
  let superAdminId: string;
  let _staffAdminId: string;
  let createdAdminId: string;

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

    // Fetch seeded super admin
    const superAdmin = await prisma.admin.findUnique({
      where: { email: 'admin@miles.io' },
    });
    if (!superAdmin) throw new Error('Seeded super admin not found');
    superAdminId = superAdmin.id;
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role,
    });

    // Fetch or ensure staff admin
    let staffAdmin = await prisma.admin.findFirst({
      where: { role: AdminRole.ADMIN },
    });
    if (!staffAdmin) {
      staffAdmin = await prisma.admin.create({
        data: {
          name: 'Staff Tester',
          email: 'staff.test@miles.io',
          passwordHash: 'dummyhash',
          role: AdminRole.ADMIN,
        },
      });
    }
    _staffAdminId = staffAdmin.id;
    staffToken = jwtService.sign({
      sub: staffAdmin.id,
      email: staffAdmin.email,
      role: staffAdmin.role,
    });
  });

  afterAll(async () => {
    // Cleanup any created admin if still present
    if (createdAdminId) {
      await prisma.admin.deleteMany({
        where: { id: createdAdminId },
      });
    }
    await app.close();
  });

  describe('GET /api/v1/admins', () => {
    it('should return paginated admin directory for SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admins?page=1&limit=10')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);

      // Verify passwords are never exposed
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('should filter admins by role', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admins?role=SUPER_ADMIN')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        expect(item.role).toBe(AdminRole.SUPER_ADMIN);
      }
    });

    it('should filter admins by search keyword', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admins?search=admin@miles.io')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].email).toBe('admin@miles.io');
    });

    it('should reject standard ADMIN with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admins')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/admins');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/admins', () => {
    it('should create new administrator account when called by SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Alice Wonder',
          email: 'alice.wonder@miles.io',
          password: 'Password123!',
          role: AdminRole.ADMIN,
          phone: '+1 555-0199',
          timezone: 'EST (UTC-05:00)',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('alice.wonder@miles.io');
      expect(res.body.data.name).toBe('Alice Wonder');
      expect(res.body.data.role).toBe(AdminRole.ADMIN);
      expect(res.body.data.passwordHash).toBeUndefined();

      createdAdminId = res.body.data.id;
    });

    it('should reject duplicate email with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Alice Duplicate',
          email: 'alice.wonder@miles.io',
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
    });

    it('should reject non-super admin with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admins')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Unauthorized Admin',
          email: 'unauth@miles.io',
          password: 'Password123!',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/admins/:id', () => {
    it('should return admin details for valid UUID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admins/${superAdminId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(superAdminId);
      expect(res.body.data.email).toBe('admin@miles.io');
    });

    it('should return 404 for non-existent admin UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admins/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admins/invalid-uuid')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/admins/:id/role', () => {
    it('should update role of target admin', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admins/${createdAdminId}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: AdminRole.SUPER_ADMIN });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(AdminRole.SUPER_ADMIN);

      // Revert back to ADMIN
      await request(app.getHttpServer())
        .patch(`/api/v1/admins/${createdAdminId}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: AdminRole.ADMIN })
        .expect(200);
    });

    it('should enforce invariant: prevent self-role demotion', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admins/${superAdminId}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: AdminRole.ADMIN });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot change your own');
    });
  });

  describe('DELETE /api/v1/admins/:id', () => {
    it('should enforce invariant: prevent self-deletion', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admins/${superAdminId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot delete your own');
    });

    it('should delete target administrator successfully', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admins/${createdAdminId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('deleted successfully');

      // Verify deletion in DB
      const check = await prisma.admin.findUnique({
        where: { id: createdAdminId },
      });
      expect(check).toBeNull();
      createdAdminId = '';
    });
  });
});
