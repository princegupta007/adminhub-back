import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;
  let mockPrismaService: {
    $queryRaw: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockPrismaService = {
      $queryRaw: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('should return health status ok with uptime and timestamp', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('getLiveness', () => {
    it('should return liveness status ok with uptime and timestamp', () => {
      const result = appController.getLiveness();
      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('getReadiness', () => {
    it('should return readiness status ok when database is accessible', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

      const result = await appController.getReadiness();

      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should throw ServiceUnavailableException when database ping fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      await expect(appController.getReadiness()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
