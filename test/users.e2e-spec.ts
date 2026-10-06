import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Users Module (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let adminToken: string;
  let createdUserCode: string;

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
    const prisma = moduleFixture.get(PrismaService);

    // Fetch live seeded admin ID dynamically
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication & Route Protection', () => {
    it('1. should reject GET /api/v1/users without JWT with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .expect(401);

      expect(res.body.statusCode).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('2. should succeed GET /api/v1/users with valid JWT and return paginated dataset', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.total).toBeGreaterThan(0);

      // Verify no passwordHash is ever exposed
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });
  });

  describe('Pagination, Search, Filtering & Sorting', () => {
    it('3. should support pagination parameters (page=2, limit=5)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users?page=2&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.meta.page).toBe(2);
      expect(res.body.meta.limit).toBe(5);
    });

    it('4. should filter users by search term q', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users?q=Sarah')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.some((u: { firstName: string }) =>
          u.firstName.toLowerCase().includes('sarah'),
        ),
      ).toBe(true);
    });

    it('5. should filter users by role (ADMIN)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users?role=ADMIN')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.every((u: { role: string }) => u.role === 'ADMIN'),
      ).toBe(true);
    });

    it('6. should filter users by status (ACTIVE)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.every((u: { status: string }) => u.status === 'ACTIVE'),
      ).toBe(true);
    });

    it('7. should sort users by name ascending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users?sortBy=name&order=asc&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(1);
      const names = res.body.data.map(
        (u: { firstName: string }) => u.firstName,
      );
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });

    it('8. should combine search, role, status, and sort coherently', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/v1/users?role=VIEWER&status=ACTIVE&sortBy=createdAt&order=desc',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        res.body.data.every(
          (u: { role: string; status: string }) =>
            u.role === 'VIEWER' && u.status === 'ACTIVE',
        ),
      ).toBe(true);
    });
  });

  describe('User Statistics', () => {
    it('16. should retrieve aggregated user statistics (GET /api/v1/users/stats)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.total).toBe('number');
      expect(typeof res.body.data.active).toBe('number');
      expect(typeof res.body.data.inactive).toBe('number');
      expect(typeof res.body.data.suspended).toBe('number');
      expect(typeof res.body.data.newThisMonth).toBe('number');
      expect(typeof res.body.data.totalChangePct).toBe('number');
      expect(typeof res.body.data.activeChangePct).toBe('number');
      expect(res.body.data.total).toBe(
        res.body.data.active + res.body.data.inactive + res.body.data.suspended,
      );
    });
  });

  describe('Single User Detail', () => {
    it('9. should retrieve single user compound details by userCode (USR-0001)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/USR-0001')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.userCode).toBe('USR-0001');
      expect(res.body.data.email).toBeDefined();
      expect(Array.isArray(res.body.data.recentTransactions)).toBe(true);
      expect(Array.isArray(res.body.data.recentBookings)).toBe(true);
      expect(Array.isArray(res.body.data.recentActivity)).toBe(true);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('18. should return 404 for non-existent user code', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/USR-999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.statusCode).toBe(404);
      expect(res.body.message).toContain('not found');
    });
  });

  describe('User Lifecycle Mutations (Create, Update, Soft Delete)', () => {
    it('10. should create a new user with atomic userCode generation (POST /api/v1/users)', async () => {
      const uniqueEmail = `test.e2e.${Date.now()}@example.com`;

      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Marcus',
          lastName: 'Vance',
          email: uniqueEmail,
          phone: '+1 (555) 777-8899',
          role: 'EDITOR',
          status: 'ACTIVE',
          addressLine: '500 Tech Blvd',
          city: 'Austin',
          state: 'TX',
          country: 'USA',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe(uniqueEmail);
      expect(res.body.data.role).toBe('EDITOR');
      expect(res.body.data.userCode).toMatch(/^USR-\d{4,}$/);

      createdUserCode = res.body.data.userCode;
    });

    it('11. should reject create with duplicate email with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Duplicate',
          lastName: 'User',
          email: 'sarah.jenkins@example.com', // already seeded
          phone: '+1 555-000-1111',
        })
        .expect(409);

      expect(res.body.statusCode).toBe(409);
      expect(res.body.message).toContain('already exists');
    });

    it('17. should reject creation with unexpected/unwhitelisted properties with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Hacker',
          lastName: 'Attempt',
          email: 'hacker@example.com',
          phone: '+1 555-000-2222',
          injectedField: 'malicious',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(
        res.body.message.some((msg: string) =>
          msg.includes('injectedField should not exist'),
        ),
      ).toBe(true);
    });

    it('12. should partially update an existing user (PATCH /api/v1/users/:code)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/users/${createdUserCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          phone: '+1 (555) 999-0000',
          role: 'ADMIN',
        })
        .expect(200);

      expect(res.body.data.phone).toBe('+1 (555) 999-0000');
      expect(res.body.data.role).toBe('ADMIN');
    });

    it('13. should soft delete the user (DELETE /api/v1/users/:code)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/users/${createdUserCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toContain('soft deleted successfully');
    });

    it('14. should exclude soft-deleted user from subsequent GET /api/v1/users listings', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/users?q=${createdUserCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        res.body.data.some(
          (u: { userCode: string }) => u.userCode === createdUserCode,
        ),
      ).toBe(false);
    });

    it('15. should return 404 when looking up soft-deleted user on GET /api/v1/users/:code', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/users/${createdUserCode}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.statusCode).toBe(404);
    });
  });
});
