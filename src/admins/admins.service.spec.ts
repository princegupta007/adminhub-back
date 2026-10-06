import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminsService } from './admins.service.js';

describe('AdminsService', () => {
  let service: AdminsService;
  let prismaService: {
    admin: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  const mockSuperAdmin = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Sarah Jenkins',
    email: 'admin@miles.io',
    passwordHash: '$2b$10$hashed',
    role: AdminRole.SUPER_ADMIN,
    avatarUrl: null,
    phone: null,
    timezone: 'PST (UTC-08:00)',
    twoFactorEnabled: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const mockStaffAdmin = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Michael Chen',
    email: 'staff@miles.io',
    passwordHash: '$2b$10$hashed',
    role: AdminRole.ADMIN,
    avatarUrl: null,
    phone: null,
    timezone: 'EST (UTC-05:00)',
    twoFactorEnabled: false,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prismaService = {
      admin: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<AdminsService>(AdminsService);
  });

  describe('findAll', () => {
    it('should return paginated admin list and metadata', async () => {
      prismaService.admin.count.mockResolvedValue(2);
      prismaService.admin.findMany.mockResolvedValue([
        mockSuperAdmin,
        mockStaffAdmin,
      ]);

      const res = await service.findAll({ page: 1, limit: 10 });

      expect(res.data).toHaveLength(2);
      expect(res.meta.total).toBe(2);
      expect(res.data[0].email).toBe('admin@miles.io');
    });

    it('should apply role filter and search query', async () => {
      prismaService.admin.count.mockResolvedValue(1);
      prismaService.admin.findMany.mockResolvedValue([mockStaffAdmin]);

      const res = await service.findAll({
        role: AdminRole.ADMIN,
        search: 'Michael',
      });

      expect(res.data).toHaveLength(1);
      expect(res.data[0].name).toBe('Michael Chen');
      expect(prismaService.admin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: AdminRole.ADMIN,
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return admin by ID', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockSuperAdmin);

      const res = await service.findOne(mockSuperAdmin.id);

      expect(res.id).toBe(mockSuperAdmin.id);
      expect(res.email).toBe(mockSuperAdmin.email);
    });

    it('should throw NotFoundException if admin not found', async () => {
      prismaService.admin.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create new admin with hashed password', async () => {
      prismaService.admin.findUnique.mockResolvedValue(null);
      vi.spyOn(bcrypt, 'hash').mockImplementation(
        async () => '$2b$10$hashedNew' as never,
      );
      prismaService.admin.create.mockResolvedValue({
        ...mockStaffAdmin,
        email: 'newadmin@miles.io',
      });

      const res = await service.create({
        name: 'New Admin',
        email: 'newadmin@miles.io',
        password: 'Password123!',
        role: AdminRole.ADMIN,
      });

      expect(res.email).toBe('newadmin@miles.io');
      expect(prismaService.admin.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'newadmin@miles.io',
            passwordHash: '$2b$10$hashedNew',
          }),
        }),
      );
    });

    it('should throw ConflictException if email is already taken', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockSuperAdmin);

      await expect(
        service.create({
          name: 'Sarah Duplicate',
          email: 'admin@miles.io',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateRole', () => {
    it('should update role when valid', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockStaffAdmin);
      prismaService.admin.update.mockResolvedValue({
        ...mockStaffAdmin,
        role: AdminRole.SUPER_ADMIN,
      });

      const res = await service.updateRole(
        mockStaffAdmin.id,
        mockSuperAdmin.id,
        { role: AdminRole.SUPER_ADMIN },
      );

      expect(res.role).toBe(AdminRole.SUPER_ADMIN);
    });

    it('should reject self-role demotion with BadRequestException', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockSuperAdmin);

      await expect(
        service.updateRole(mockSuperAdmin.id, mockSuperAdmin.id, {
          role: AdminRole.ADMIN,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject demoting the sole Super Admin with BadRequestException', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockSuperAdmin);
      prismaService.admin.count.mockResolvedValue(1);

      await expect(
        service.updateRole(mockSuperAdmin.id, 'another-caller-id', {
          role: AdminRole.ADMIN,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should delete admin successfully', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockStaffAdmin);
      prismaService.admin.delete.mockResolvedValue(mockStaffAdmin);

      const res = await service.delete(mockStaffAdmin.id, mockSuperAdmin.id);

      expect(res.message).toBe('Administrator account deleted successfully');
      expect(prismaService.admin.delete).toHaveBeenCalledWith({
        where: { id: mockStaffAdmin.id },
      });
    });

    it('should reject self-deletion with BadRequestException', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockSuperAdmin);

      await expect(
        service.delete(mockSuperAdmin.id, mockSuperAdmin.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject deleting the sole Super Admin with BadRequestException', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockSuperAdmin);
      prismaService.admin.count.mockResolvedValue(1);

      await expect(
        service.delete(mockSuperAdmin.id, 'another-caller-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if admin not found', async () => {
      prismaService.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.delete('non-existent', mockSuperAdmin.id),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
