import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActivitiesService } from './activities.service.js';

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let prismaService: {
    activityLog: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const mockActivity = {
    id: '44444444-4444-4444-4444-444444444444',
    userId: '55555555-5555-5555-5555-555555555555',
    action: 'Profile Updated',
    description: 'Updated delivery address and phone number',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    user: {
      id: '55555555-5555-5555-5555-555555555555',
      userCode: 'USR-0001',
      firstName: 'Sarah',
      lastName: 'Connor',
      email: 'sarah.connor@example.com',
    },
  };

  beforeEach(async () => {
    prismaService = {
      activityLog: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
  });

  describe('findAll', () => {
    it('should return paginated activity logs', async () => {
      prismaService.activityLog.count.mockResolvedValue(1);
      prismaService.activityLog.findMany.mockResolvedValue([mockActivity]);

      const res = await service.findAll({ page: 1, limit: 10 });

      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBe(1);
      expect(res.data[0].action).toBe('Profile Updated');
      expect(res.data[0].user?.name).toBe('Sarah Connor');
    });

    it('should apply filters for userId, action, search, and date range', async () => {
      prismaService.activityLog.count.mockResolvedValue(1);
      prismaService.activityLog.findMany.mockResolvedValue([mockActivity]);

      const res = await service.findAll({
        userId: '55555555-5555-5555-5555-555555555555',
        action: 'Profile',
        search: 'delivery',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-02T00:00:00.000Z',
      });

      expect(res.data).toHaveLength(1);
      expect(prismaService.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: '55555555-5555-5555-5555-555555555555',
            action: expect.objectContaining({ contains: 'Profile' }),
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });
});
