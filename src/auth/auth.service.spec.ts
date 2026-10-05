import { UnauthorizedException } from '@nestjs/common';
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
});
