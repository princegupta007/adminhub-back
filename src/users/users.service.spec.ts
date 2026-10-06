import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    activityLog: {
      create: ReturnType<typeof vi.fn>;
      createMany: ReturnType<typeof vi.fn>;
    };
    getNextSequenceValue: ReturnType<typeof vi.fn>;
    $transaction: ReturnType<typeof vi.fn>;
  };

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userCode: 'USR-0001',
    firstName: 'Sarah',
    lastName: 'Jenkins',
    email: 'sarah.jenkins@example.com',
    phone: '+1 555-014-2210',
    dateOfBirth: new Date('1990-05-15'),
    addressLine: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    country: 'USA',
    avatarUrl: 'https://avatar.url',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    twoFactorEnabled: true,
    joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    lastLoginAt: new Date('2026-10-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    transactions: [],
    bookings: [],
    activities: [],
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      activityLog: {
        create: vi.fn(),
        createMany: vi.fn(),
      },
      getNextSequenceValue: vi.fn(),
      $transaction: vi.fn().mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return Promise.all(callback);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('should return paginated user summary list', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        order: 'desc',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Sarah Jenkins');
      expect(result.data[0].userCode).toBe('USR-0001');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should construct search filter across name, email, and userCode', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 10,
        q: 'Sarah',
        sortBy: 'createdAt',
        order: 'desc',
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            OR: expect.arrayContaining([
              { firstName: { contains: 'Sarah', mode: 'insensitive' } },
              { lastName: { contains: 'Sarah', mode: 'insensitive' } },
              { email: { contains: 'Sarah', mode: 'insensitive' } },
              { userCode: { contains: 'Sarah', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should apply role and status filters', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 10,
        role: UserRole.EDITOR,
        status: UserStatus.SUSPENDED,
        sortBy: 'createdAt',
        order: 'desc',
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            role: UserRole.EDITOR,
            status: UserStatus.SUSPENDED,
          }),
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should calculate live user statistics and MoM growth', async () => {
      prisma.user.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(40) // active
        .mockResolvedValueOnce(6) // inactive
        .mockResolvedValueOnce(4) // suspended
        .mockResolvedValueOnce(10) // newThisMonth
        .mockResolvedValueOnce(5); // newLastMonth

      const stats = await service.getStats();

      expect(stats.total).toBe(50);
      expect(stats.active).toBe(40);
      expect(stats.inactive).toBe(6);
      expect(stats.suspended).toBe(4);
      expect(stats.newThisMonth).toBe(10);
      expect(stats.totalChangePct).toBe(100.0); // ((10-5)/5)*100
    });
  });

  describe('findOne', () => {
    it('should resolve user detail by userCode with bounded collections', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        transactions: [],
        bookings: [],
        activities: [],
      });

      const result = await service.findOne('USR-0001');

      expect(result.id).toBe(mockUser.id);
      expect(result.userCode).toBe('USR-0001');
      expect(result.recentTransactions).toEqual([]);
      expect(result.recentBookings).toEqual([]);
      expect(result.recentActivity).toEqual([]);
    });

    it('should resolve user detail by UUID', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        transactions: [],
        bookings: [],
        activities: [],
      });

      const result = await service.findOne(mockUser.id);
      expect(result.id).toBe(mockUser.id);
    });

    it('should throw NotFoundException if user is not found or soft-deleted', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne('USR-9999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should allocate next atomic sequence code and create user with activity log', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.getNextSequenceValue.mockResolvedValue(51);
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        userCode: 'USR-0051',
        email: 'newuser@example.com',
      });
      prisma.activityLog.create.mockResolvedValue({});

      const result = await service.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'NewUser@example.com',
        phone: '+1 555-123-4567',
      });

      expect(result.userCode).toBe('USR-0051');
      expect(prisma.getNextSequenceValue).toHaveBeenCalledWith('user_code_seq');
    });

    it('should throw ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'sarah.jenkins@example.com',
          phone: '+1 555-123-4567',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should partially update user attributes and record activity log', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        phone: '+1 555-999-9999',
      });
      prisma.activityLog.create.mockResolvedValue({});

      const result = await service.update(mockUser.userCode, {
        phone: '+1 555-999-9999',
      });

      expect(result.phone).toBe('+1 555-999-9999');
    });

    it('should throw ConflictException if new email collides with another user', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(mockUser) // findActiveUserRecord
        .mockResolvedValueOnce({
          id: 'another-user-id',
          email: 'taken@example.com',
        }); // email conflict check

      await expect(
        service.update(mockUser.userCode, {
          email: 'taken@example.com',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should soft delete user by setting deletedAt timestamp', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        deletedAt: new Date(),
        status: UserStatus.INACTIVE,
      });
      prisma.activityLog.create.mockResolvedValue({});

      const result = await service.remove(mockUser.userCode);

      expect(result.success).toBe(true);
      expect(result.message).toContain('soft deleted successfully');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.remove('USR-NONE')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('bulkStatus', () => {
    it('should bulk update user status and append activity logs', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          userCode: 'USR-0001',
          firstName: 'Sarah',
          lastName: 'Jenkins',
        },
        { id: 'u2', userCode: 'USR-0002', firstName: 'John', lastName: 'Doe' },
      ]);
      prisma.user.updateMany.mockResolvedValue({ count: 2 });
      prisma.activityLog.createMany.mockResolvedValue({ count: 2 });

      const res = await service.bulkStatus({
        userCodes: ['USR-0001', 'USR-0002'],
        status: UserStatus.SUSPENDED,
      });

      expect(res.success).toBe(true);
      expect(res.affectedCount).toBe(2);
      expect(res.affectedCodes).toEqual(['USR-0001', 'USR-0002']);
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1', 'u2'] } },
        data: { status: UserStatus.SUSPENDED },
      });
    });

    it('should return 0 affected when no matching users found', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const res = await service.bulkStatus({
        userCodes: ['USR-NONE'],
        status: UserStatus.ACTIVE,
      });

      expect(res.affectedCount).toBe(0);
      expect(res.affectedCodes).toEqual([]);
    });
  });

  describe('bulkRole', () => {
    it('should bulk update user roles and append activity logs', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          userCode: 'USR-0001',
          firstName: 'Sarah',
          lastName: 'Jenkins',
        },
      ]);
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      prisma.activityLog.createMany.mockResolvedValue({ count: 1 });

      const res = await service.bulkRole({
        userCodes: ['USR-0001'],
        role: UserRole.ADMIN,
      });

      expect(res.success).toBe(true);
      expect(res.affectedCount).toBe(1);
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1'] } },
        data: { role: UserRole.ADMIN },
      });
    });
  });

  describe('bulkDelete', () => {
    it('should bulk soft-delete users', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          userCode: 'USR-0001',
          firstName: 'Sarah',
          lastName: 'Jenkins',
        },
      ]);
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      prisma.activityLog.createMany.mockResolvedValue({ count: 1 });

      const res = await service.bulkDelete({
        userCodes: ['USR-0001'],
      });

      expect(res.success).toBe(true);
      expect(res.affectedCount).toBe(1);
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1'] } },
        data: expect.objectContaining({
          status: UserStatus.INACTIVE,
          deletedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('exportCsv', () => {
    it('should generate valid RFC 4180 CSV matching filters', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const csv = await service.exportCsv({ role: UserRole.ADMIN });

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('User Code,Name,Email,Phone,Role,Status');
      expect(csv).toContain('USR-0001,Sarah Jenkins,sarah.jenkins@example.com');
    });
  });
});
