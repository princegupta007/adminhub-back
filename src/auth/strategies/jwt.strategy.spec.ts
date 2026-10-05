import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;
  let prismaService: {
    admin: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prismaService = {
      admin: {
        findUnique: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should validate and return user without passwordHash when admin exists', async () => {
    const mockAdmin = {
      id: 'admin-uuid',
      email: 'admin@miles.io',
      name: 'Sarah Jenkins',
      role: AdminRole.SUPER_ADMIN,
      avatarUrl: 'https://avatar.url',
    };
    prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

    const result = await jwtStrategy.validate({
      sub: 'admin-uuid',
      email: 'admin@miles.io',
      role: AdminRole.SUPER_ADMIN,
    });

    expect(result).toEqual(mockAdmin);
    expect((result as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('should throw UnauthorizedException when admin no longer exists in database', async () => {
    prismaService.admin.findUnique.mockResolvedValue(null);

    await expect(
      jwtStrategy.validate({
        sub: 'deleted-admin-uuid',
        email: 'deleted@miles.io',
        role: AdminRole.ADMIN,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when payload sub is missing', async () => {
    await expect(
      jwtStrategy.validate({
        sub: '',
        email: 'no-sub@miles.io',
        role: AdminRole.ADMIN,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
