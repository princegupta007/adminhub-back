import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from './settings.service.js';

describe('SettingsService', () => {
  let service: SettingsService;
  let prismaService: {
    workspaceSetting: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  const mockSettings = {
    id: '33333333-3333-3333-3333-333333333333',
    workspaceName: 'AdminHub',
    supportEmail: 'support@adminhub.io',
    currency: 'USD',
    timezone: 'PST (UTC-08:00)',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prismaService = {
      workspaceSetting: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  describe('getSettings', () => {
    it('should return existing workspace settings', async () => {
      prismaService.workspaceSetting.findFirst.mockResolvedValue(mockSettings);

      const res = await service.getSettings();

      expect(res.workspaceName).toBe('AdminHub');
      expect(res.supportEmail).toBe('support@adminhub.io');
      expect(res.currency).toBe('USD');
    });

    it('should initialize and return defaults if no settings record exists', async () => {
      prismaService.workspaceSetting.findFirst.mockResolvedValue(null);
      prismaService.workspaceSetting.create.mockResolvedValue(mockSettings);

      const res = await service.getSettings();

      expect(res.workspaceName).toBe('AdminHub');
      expect(prismaService.workspaceSetting.create).toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('should update workspace settings fields', async () => {
      prismaService.workspaceSetting.findFirst.mockResolvedValue(mockSettings);
      const updated = {
        ...mockSettings,
        workspaceName: 'Enterprise Hub',
        currency: 'EUR',
      };
      prismaService.workspaceSetting.update.mockResolvedValue(updated);

      const res = await service.updateSettings({
        workspaceName: 'Enterprise Hub',
        currency: 'EUR',
      });

      expect(res.workspaceName).toBe('Enterprise Hub');
      expect(res.currency).toBe('EUR');
      expect(prismaService.workspaceSetting.update).toHaveBeenCalledWith({
        where: { id: mockSettings.id },
        data: expect.objectContaining({
          workspaceName: 'Enterprise Hub',
          currency: 'EUR',
        }),
      });
    });
  });
});
