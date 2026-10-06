import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import type { Express } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('Auth & Security (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let validAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable trust proxy so X-Forwarded-For is respected by Express and ThrottlerGuard
    const expressApp = app.getHttpAdapter().getInstance() as Express;
    expressApp.set('trust proxy', true);

    // Replicate main.ts configuration in E2E environment
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('1. should succeed with seeded credentials and return JWT & admin profile', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.0.1.1')
        .send({
          email: 'admin@miles.io',
          password: 'Admin@123',
        })
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(res.body.data.admin).toBeDefined();
      expect(res.body.data.admin.email).toBe('admin@miles.io');
      expect(res.body.data.admin.name).toBe('Sarah Jenkins');
      expect(res.body.data.admin.role).toBe('SUPER_ADMIN');

      // 14. Verify passwordHash is never returned
      expect(res.body.data.admin.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      validAccessToken = res.body.data.accessToken;
    });

    it('2. should reject invalid password with generic 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.0.1.2')
        .send({
          email: 'admin@miles.io',
          password: 'IncorrectPassword',
        })
        .expect(401);

      expect(res.body.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
      expect(res.body.error).toBe('Unauthorized');
    });

    it('2b. should reject non-existent admin email with generic 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.0.1.3')
        .send({
          email: 'nobody@miles.io',
          password: 'Password@123',
        })
        .expect(401);

      expect(res.body.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('3. should reject missing email with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.0.1.4')
        .send({
          password: 'Admin@123',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(
        res.body.message.some((msg: string) => msg.includes('email')),
      ).toBe(true);
    });

    it('4. should reject missing password with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.0.1.5')
        .send({
          email: 'admin@miles.io',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(
        res.body.message.some((msg: string) => msg.includes('password')),
      ).toBe(true);
    });

    it('5. should reject invalid email format with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.0.1.6')
        .send({
          email: 'not-an-email-format',
          password: 'Admin@123',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(
        res.body.message.some((msg: string) => msg.includes('email')),
      ).toBe(true);
    });

    it('15. should reject unexpected DTO property (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.0.1.7')
        .send({
          email: 'admin@miles.io',
          password: 'Admin@123',
          maliciousField: 'exploit',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(
        res.body.message.some((msg: string) =>
          msg.includes('maliciousField should not exist'),
        ),
      ).toBe(true);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('10. should return authenticated admin profile using valid bearer token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe('admin@miles.io');
      expect(res.body.data.role).toBe('SUPER_ADMIN');
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('11. should reject request with missing Authorization header with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);

      expect(res.body.statusCode).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('9. should reject malformed or invalid JWT with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload')
        .expect(401);

      expect(res.body.statusCode).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('8. should reject expired JWT with 401 Token has expired', async () => {
      // Create an expired token (-10 seconds)
      const expiredToken = jwtService.sign(
        {
          sub: '11111111-1111-1111-1111-111111111111',
          email: 'admin@miles.io',
          role: 'SUPER_ADMIN',
        },
        { expiresIn: '-10s' },
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body.statusCode).toBe(401);
      expect(res.body.message).toContain('expired');
    });
  });

  describe('Admin Self-Service & Profile Security', () => {
    it('should update admin profile display attributes', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({
          name: 'Sarah Connor',
          phone: '+1 (555) 014-9999',
          timezone: 'EST (UTC-05:00)',
        })
        .expect(200);

      expect(res.body.data.name).toBe('Sarah Connor');
      expect(res.body.data.phone).toBe('+1 (555) 014-9999');
      expect(res.body.data.timezone).toBe('EST (UTC-05:00)');
      expect(res.body.data.passwordHash).toBeUndefined();

      // Reset name back to Sarah Jenkins
      await request(app.getHttpServer())
        .patch('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ name: 'Sarah Jenkins' })
        .expect(200);
    });

    it('should update preferences (toggle 2FA)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/auth/preferences')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ twoFactorEnabled: false })
        .expect(200);

      expect(res.body.data.twoFactorEnabled).toBe(false);

      // Revert back
      await request(app.getHttpServer())
        .patch('/api/v1/auth/preferences')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ twoFactorEnabled: true })
        .expect(200);
    });

    it('should validate and change password, then allow login with new password', async () => {
      // 1. Wrong current password -> 400
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({
          currentPassword: 'WrongPassword123',
          newPassword: 'BrandNewPassword1!',
        })
        .expect(400);

      // 2. Same password -> 400
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({
          currentPassword: 'Admin@123',
          newPassword: 'Admin@123',
        })
        .expect(400);

      // 3. Success change password
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({
          currentPassword: 'Admin@123',
          newPassword: 'BrandNewPassword1!',
        })
        .expect(200);

      // 4. Change back to original so test suite remains idempotent
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({
          currentPassword: 'BrandNewPassword1!',
          newPassword: 'Admin@123',
        })
        .expect(200);
    });
  });

  describe('Public Routes & Security Headers', () => {
    it('12. should allow unauthenticated access to /health and /api/v1/health', async () => {
      const resHealth = await request(app.getHttpServer())
        .get('/health')
        .expect(200);
      expect(resHealth.body.status).toBe('ok');

      const resApiHealth = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      expect(resApiHealth.body.status).toBe('ok');
    });
  });

  describe('13. Rate Limiting (Login Throttling)', () => {
    it('should trigger 429 Too Many Requests when default login limit (5) is exceeded from same IP', async () => {
      let hit429 = false;
      const testIp = '192.168.100.99';

      // Send 7 requests with identical IP
      for (let i = 0; i < 7; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', testIp)
          .send({
            email: 'admin@miles.io',
            password: 'WrongPassword',
          });

        if (res.status === 429) {
          hit429 = true;
          expect(res.body.statusCode).toBe(429);
          expect(res.body.error).toBe('Too Many Requests');
          expect(res.body.message).toBe('Too Many Requests');
          break;
        }
      }

      expect(hit429).toBe(true);
    });

    it('should dynamically honor custom configured LOGIN_THROTTLE_LIMIT from environment', async () => {
      // Temporarily set custom LOGIN_THROTTLE_LIMIT = 2
      const originalEnv = process.env.LOGIN_THROTTLE_LIMIT;
      process.env.LOGIN_THROTTLE_LIMIT = '2';

      try {
        const dynamicModule: TestingModule = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();

        const dynamicApp = dynamicModule.createNestApplication();
        const expressApp = dynamicApp.getHttpAdapter().getInstance() as Express;
        expressApp.set('trust proxy', true);
        dynamicApp.setGlobalPrefix('api/v1', {
          exclude: ['health', 'api/v1/health'],
        });
        await dynamicApp.init();

        const customIp = '10.88.88.88';

        // Attempt 1: 401
        const r1 = await request(dynamicApp.getHttpServer())
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', customIp)
          .send({ email: 'admin@miles.io', password: 'bad1' });
        expect(r1.status).toBe(401);

        // Attempt 2: 401
        const r2 = await request(dynamicApp.getHttpServer())
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', customIp)
          .send({ email: 'admin@miles.io', password: 'bad2' });
        expect(r2.status).toBe(401);

        // Attempt 3: 429 (should trigger on 3rd attempt because limit is 2)
        const r3 = await request(dynamicApp.getHttpServer())
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', customIp)
          .send({ email: 'admin@miles.io', password: 'bad3' });
        expect(r3.status).toBe(429);
        expect(r3.body.statusCode).toBe(429);

        await dynamicApp.close();
      } finally {
        process.env.LOGIN_THROTTLE_LIMIT = originalEnv;
      }
    });
  });
});
