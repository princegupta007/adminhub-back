import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: {
    admin: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let jwtService: {
    sign: ReturnType<typeof vi.fn>;
  };

  const mockAdmin = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Sarah Jenkins',
    email: 'admin@miles.io',
    passwordHash: '$2b$10$mockHashedPassword123456789012345678901234567890',
    role: AdminRole.SUPER_ADMIN,
    avatarUrl: 'https://i.pravatar.cc/150?u=admin_sarah',
    phone: '+1 555-014-2210',
    timezone: 'PST (UTC-08:00)',
    twoFactorEnabled: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prismaService = {
      admin: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    jwtService = {
      sign: vi.fn().mockReturnValue('mock.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should successfully authenticate and return accessToken and admin profile without passwordHash', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      vi.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

      const result = await authService.login({
        email: 'admin@miles.io',
        password: 'Admin@123',
      });

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.admin.id).toBe(mockAdmin.id);
      expect(result.admin.email).toBe(mockAdmin.email);
      expect(result.admin.name).toBe(mockAdmin.name);
      expect(result.admin.role).toBe(AdminRole.SUPER_ADMIN);
      expect(
        (result.admin as Record<string, unknown>).passwordHash,
      ).toBeUndefined();
      expect((result as Record<string, unknown>).passwordHash).toBeUndefined();

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockAdmin.id,
        email: mockAdmin.email,
        role: mockAdmin.role,
      });
    });

    it('should throw UnauthorizedException when admin email is not found', async () => {
      prismaService.admin.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'unknown@miles.io',
          password: 'Password@123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      vi.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

      await expect(
        authService.login({
          email: 'admin@miles.io',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should return admin profile without passwordHash', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

      const profile = await authService.getProfile(mockAdmin.id);

      expect(profile).toBeDefined();
      expect(profile.id).toBe(mockAdmin.id);
      expect(profile.email).toBe(mockAdmin.email);
      expect((profile as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('should throw UnauthorizedException if admin does not exist', async () => {
      prismaService.admin.findUnique.mockResolvedValue(null);

      await expect(authService.getProfile('non-existent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update name, phone, timezone, and avatarUrl', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      const updatedAdmin = {
        ...mockAdmin,
        name: 'Sarah Connor',
        phone: '+1 555-999-0000',
        timezone: 'EST (UTC-05:00)',
      };
      prismaService.admin.update.mockResolvedValue(updatedAdmin);

      const res = await authService.updateProfile(mockAdmin.id, {
        name: 'Sarah Connor',
        phone: '+1 555-999-0000',
        timezone: 'EST (UTC-05:00)',
      });

      expect(res.name).toBe('Sarah Connor');
      expect(res.phone).toBe('+1 555-999-0000');
      expect(res.timezone).toBe('EST (UTC-05:00)');
      expect(prismaService.admin.update).toHaveBeenCalledWith({
        where: { id: mockAdmin.id },
        data: {
          name: 'Sarah Connor',
          phone: '+1 555-999-0000',
          timezone: 'EST (UTC-05:00)',
        },
      });
    });

    it('should throw UnauthorizedException if admin does not exist', async () => {
      prismaService.admin.findUnique.mockResolvedValue(null);

      await expect(
        authService.updateProfile('non-existent-id', { name: 'Test' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('should change password when current password is valid', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      vi.spyOn(bcrypt, 'compare').mockImplementation(async () => true);
      vi.spyOn(bcrypt, 'hash').mockImplementation(
        async () => '$2b$10$newHashedPassword1234567890' as never,
      );
      prismaService.admin.update.mockResolvedValue(mockAdmin);

      const res = await authService.changePassword(mockAdmin.id, {
        currentPassword: 'CurrentPassword123',
        newPassword: 'NewPassword123!',
      });

      expect(res.message).toBe('Password updated successfully');
      expect(prismaService.admin.update).toHaveBeenCalledWith({
        where: { id: mockAdmin.id },
        data: { passwordHash: '$2b$10$newHashedPassword1234567890' },
      });
    });

    it('should reject with BadRequestException when current password does not match', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      vi.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

      await expect(
        authService.changePassword(mockAdmin.id, {
          currentPassword: 'WrongPassword',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject with BadRequestException when new password matches current password', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      vi.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

      await expect(
        authService.changePassword(mockAdmin.id, {
          currentPassword: 'SamePassword123',
          newPassword: 'SamePassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePreferences', () => {
    it('should update two-factor authentication toggle', async () => {
      prismaService.admin.findUnique.mockResolvedValue(mockAdmin);
      const updatedAdmin = { ...mockAdmin, twoFactorEnabled: false };
      prismaService.admin.update.mockResolvedValue(updatedAdmin);

      const res = await authService.updatePreferences(mockAdmin.id, {
        twoFactorEnabled: false,
      });

      expect(res.twoFactorEnabled).toBe(false);
      expect(prismaService.admin.update).toHaveBeenCalledWith({
        where: { id: mockAdmin.id },
        data: { twoFactorEnabled: false },
      });
    });
  });
});
