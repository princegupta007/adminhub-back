import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Activities Stream (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let adminToken: string;
  let sampleUserId: string;

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
    if (!admin) throw new Error('Admin not found');
    adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });

    const user = await prisma.user.findFirst();
    if (user) {
      sampleUserId = user.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/activities', () => {
    it('should return paginated activity logs for authenticated admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/activities?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);

      if (res.body.data.length > 0) {
        const item = res.body.data[0];
        expect(item.id).toBeDefined();
        expect(item.userId).toBeDefined();
        expect(item.action).toBeDefined();
        expect(item.description).toBeDefined();
        expect(item.createdAt).toBeDefined();
      }
    });

    it('should filter activities by userId', async () => {
      if (!sampleUserId) return;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/activities?userId=${sampleUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        expect(item.userId).toBe(sampleUserId);
      }
    });

    it('should filter activities by search keyword', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/activities?search=User')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/activities');
      expect(res.status).toBe(401);
    });
  });
});
