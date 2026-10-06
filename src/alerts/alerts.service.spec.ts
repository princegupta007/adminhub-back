import { NotFoundException } from '@nestjs/common';
import { AlertSeverity } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlertsService } from './alerts.service.js';

describe('AlertsService', () => {
  let service: AlertsService;
  let prisma: PrismaService;

  const mockDate = new Date('2026-10-05T18:00:00.000Z');

  const mockAlert = {
    id: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
    title: 'Server capacity at 92%',
    description: 'Scale compute resources immediately',
    severity: AlertSeverity.CRITICAL,
    isResolved: false,
    createdAt: mockDate,
  };

  const mockPrismaService = {
    alert: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = mockPrismaService as unknown as PrismaService;
    service = new AlertsService(prisma);
  });

  describe('mapAlertTone', () => {
    it('should map CRITICAL to danger', () => {
      expect(service.mapAlertTone(AlertSeverity.CRITICAL)).toBe('danger');
    });

    it('should map WARNING to warning', () => {
      expect(service.mapAlertTone(AlertSeverity.WARNING)).toBe('warning');
    });

    it('should map INFO to info', () => {
      expect(service.mapAlertTone(AlertSeverity.INFO)).toBe('info');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative times correctly', () => {
      const now = new Date();
      expect(service.formatRelativeTime(new Date(now.getTime() - 20000))).toBe(
        'Just now',
      );
      expect(
        service.formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000)),
      ).toBe('5 minutes ago');
      expect(
        service.formatRelativeTime(new Date(now.getTime() - 3 * 3600 * 1000)),
      ).toBe('3 hours ago');
    });
  });

  describe('findAll', () => {
    it('should return paginated alerts with metadata when no filters provided', async () => {
      mockPrismaService.alert.count.mockResolvedValue(1);
      mockPrismaService.alert.findMany.mockResolvedValue([mockAlert]);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockAlert.id);
      expect(result.data[0].tone).toBe('danger');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter alerts by search keyword across title and description', async () => {
      mockPrismaService.alert.count.mockResolvedValue(1);
      mockPrismaService.alert.findMany.mockResolvedValue([mockAlert]);

      const result = await service.findAll({ search: 'capacity' });

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: 'capacity', mode: 'insensitive' } },
            { description: { contains: 'capacity', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter alerts by severity and resolution status', async () => {
      mockPrismaService.alert.count.mockResolvedValue(1);
      mockPrismaService.alert.findMany.mockResolvedValue([mockAlert]);

      await service.findAll({
        severity: AlertSeverity.CRITICAL,
        isResolved: false,
        sortBy: 'title',
        order: 'asc',
      });

      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith({
        where: {
          severity: AlertSeverity.CRITICAL,
          isResolved: false,
        },
        skip: 0,
        take: 10,
        orderBy: { title: 'asc' },
      });
    });
  });

  describe('getStats', () => {
    it('should return accurate counts for total, active, resolved, and severity tiers', async () => {
      mockPrismaService.alert.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3) // active
        .mockResolvedValueOnce(7) // resolved
        .mockResolvedValueOnce(1) // critical
        .mockResolvedValueOnce(1) // warning
        .mockResolvedValueOnce(1); // info

      const stats = await service.getStats();

      expect(stats).toEqual({
        total: 10,
        active: 3,
        resolved: 7,
        critical: 1,
        warning: 1,
        info: 1,
      });
    });
  });

  describe('findById', () => {
    it('should return mapped alert DTO when alert exists', async () => {
      mockPrismaService.alert.findUnique.mockResolvedValue(mockAlert);

      const alert = await service.findById(mockAlert.id);

      expect(alert.id).toBe(mockAlert.id);
      expect(alert.title).toBe(mockAlert.title);
      expect(alert.tone).toBe('danger');
    });

    it('should throw NotFoundException when alert does not exist', async () => {
      mockPrismaService.alert.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create alert with trimmed fields and default severity INFO', async () => {
      const createdAlert = {
        ...mockAlert,
        title: 'New Alert',
        description: 'New Description',
        severity: AlertSeverity.INFO,
      };
      mockPrismaService.alert.create.mockResolvedValue(createdAlert);

      const result = await service.create({
        title: '  New Alert  ',
        description: '  New Description  ',
      });

      expect(result.title).toBe('New Alert');
      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: {
          title: 'New Alert',
          description: 'New Description',
          severity: AlertSeverity.INFO,
          isResolved: false,
        },
      });
    });

    it('should create alert with specified severity', async () => {
      mockPrismaService.alert.create.mockResolvedValue(mockAlert);

      await service.create({
        title: mockAlert.title,
        description: mockAlert.description,
        severity: AlertSeverity.CRITICAL,
      });

      expect(mockPrismaService.alert.create).toHaveBeenCalledWith({
        data: {
          title: mockAlert.title,
          description: mockAlert.description,
          severity: AlertSeverity.CRITICAL,
          isResolved: false,
        },
      });
    });
  });

  describe('update', () => {
    it('should update alert fields and return mapped DTO', async () => {
      mockPrismaService.alert.findUnique.mockResolvedValue(mockAlert);
      const updatedAlert = {
        ...mockAlert,
        title: 'Updated Title',
        isResolved: true,
      };
      mockPrismaService.alert.update.mockResolvedValue(updatedAlert);

      const result = await service.update(mockAlert.id, {
        title: 'Updated Title',
        isResolved: true,
      });

      expect(result.title).toBe('Updated Title');
      expect(result.isResolved).toBe(true);
      expect(mockPrismaService.alert.update).toHaveBeenCalledWith({
        where: { id: mockAlert.id },
        data: {
          title: 'Updated Title',
          isResolved: true,
        },
      });
    });

    it('should throw NotFoundException when updating non-existent alert', async () => {
      mockPrismaService.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolve', () => {
    it('should mark alert as resolved and return confirmation', async () => {
      mockPrismaService.alert.findUnique.mockResolvedValue(mockAlert);
      mockPrismaService.alert.update.mockResolvedValue({
        ...mockAlert,
        isResolved: true,
      });

      const result = await service.resolve(mockAlert.id);

      expect(result).toEqual({
        id: mockAlert.id,
        isResolved: true,
        message: 'Alert marked as resolved',
      });
      expect(mockPrismaService.alert.update).toHaveBeenCalledWith({
        where: { id: mockAlert.id },
        data: { isResolved: true },
      });
    });

    it('should throw NotFoundException when resolving non-existent alert', async () => {
      mockPrismaService.alert.findUnique.mockResolvedValue(null);

      await expect(service.resolve('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('batchResolve', () => {
    it('should resolve multiple alerts by ID list and return resolved count', async () => {
      mockPrismaService.alert.updateMany.mockResolvedValue({ count: 2 });
      const ids = [
        'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
        'b2f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
      ];

      const result = await service.batchResolve({ ids });

      expect(result).toEqual({
        resolvedCount: 2,
        ids,
        message: 'Successfully resolved 2 alerts',
      });
      expect(mockPrismaService.alert.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ids } },
        data: { isResolved: true },
      });
    });
  });

  describe('resolveAll', () => {
    it('should resolve all active alerts and return count', async () => {
      mockPrismaService.alert.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.resolveAll();

      expect(result).toEqual({
        resolvedCount: 5,
        message: 'All active alerts marked as resolved',
      });
      expect(mockPrismaService.alert.updateMany).toHaveBeenCalledWith({
        where: { isResolved: false },
        data: { isResolved: true },
      });
    });
  });

  describe('delete', () => {
    it('should delete alert and return confirmation', async () => {
      mockPrismaService.alert.findUnique.mockResolvedValue(mockAlert);
      mockPrismaService.alert.delete.mockResolvedValue(mockAlert);

      const result = await service.delete(mockAlert.id);

      expect(result).toEqual({
        id: mockAlert.id,
        message: 'Alert deleted successfully',
      });
      expect(mockPrismaService.alert.delete).toHaveBeenCalledWith({
        where: { id: mockAlert.id },
      });
    });

    it('should throw NotFoundException when deleting non-existent alert', async () => {
      mockPrismaService.alert.findUnique.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getNotificationsFeed', () => {
    it('should return formatted notifications feed with unread count', async () => {
      mockPrismaService.alert.count.mockResolvedValue(3);
      mockPrismaService.alert.findMany.mockResolvedValue([mockAlert]);

      const feed = await service.getNotificationsFeed(5);

      expect(feed.unreadCount).toBe(3);
      expect(feed.notifications).toHaveLength(1);
      expect(feed.notifications[0]).toEqual({
        id: mockAlert.id,
        title: mockAlert.title,
        body: mockAlert.description,
        tone: 'danger',
        severity: AlertSeverity.CRITICAL,
        time: service.formatRelativeTime(mockDate),
        unread: true,
        createdAt: mockDate.toISOString(),
      });
    });
  });
});
