import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Workspace Settings (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let superAdminToken: string;
  let staffToken: string;

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
    if (!superAdmin) throw new Error('Super admin not found');
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role,
    });

    let staffAdmin = await prisma.admin.findFirst({
      where: { role: AdminRole.ADMIN },
    });
    if (!staffAdmin) {
      staffAdmin = await prisma.admin.create({
        data: {
          name: 'Staff Tester',
          email: 'staff.tester@miles.io',
          passwordHash: 'dummyhash',
          role: AdminRole.ADMIN,
        },
      });
    }
    staffToken = jwtService.sign({
      sub: staffAdmin.id,
      email: staffAdmin.email,
      role: staffAdmin.role,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/settings', () => {
    it('should allow SUPER_ADMIN to retrieve workspace settings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.workspaceName).toBeDefined();
      expect(res.body.data.supportEmail).toBeDefined();
      expect(res.body.data.currency).toBeDefined();
    });

    it('should allow standard ADMIN to retrieve workspace settings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/settings');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/settings', () => {
    it('should update settings when called by SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          workspaceName: 'AdminHub Global',
          supportEmail: 'ops@adminhub.io',
          currency: 'USD',
          timezone: 'PST (UTC-08:00)',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.workspaceName).toBe('AdminHub Global');
      expect(res.body.data.supportEmail).toBe('ops@adminhub.io');

      // Revert back
      await request(app.getHttpServer())
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          workspaceName: 'AdminHub',
          supportEmail: 'support@adminhub.io',
        })
        .expect(200);
    });

    it('should reject update from standard ADMIN with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          workspaceName: 'Hacked Hub',
        });

      expect(res.status).toBe(403);
    });

    it('should reject invalid email format with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          supportEmail: 'not-an-email',
        });

      expect(res.status).toBe(400);
    });
  });
});
