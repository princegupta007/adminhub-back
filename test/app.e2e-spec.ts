import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('AppController & Health Probes (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.setGlobalPrefix('api/v1', {
      exclude: [
        'health',
        'health/live',
        'health/ready',
        'api/v1/health',
        'api/v1/health/live',
        'api/v1/health/ready',
      ],
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Heartbeat Probes (/health and /api/v1/health)', () => {
    it('/health (GET) should return 200 with status ok', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
    });

    it('/api/v1/health (GET) should return 200 with status ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('Liveness Probes (/health/live and /api/v1/health/live)', () => {
    it('/health/live (GET) should return 200 with status ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
    });

    it('/api/v1/health/live (GET) should return 200 with status ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('Readiness Probes (/health/ready and /api/v1/health/ready)', () => {
    it('/health/ready (GET) should return 200 with database connected', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
    });

    it('/api/v1/health/ready (GET) should return 200 with database connected', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('Production Security Headers (Helmet)', () => {
    it('should include Helmet security headers in responses', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-download-options']).toBe('noopen');
    });
  });
});
