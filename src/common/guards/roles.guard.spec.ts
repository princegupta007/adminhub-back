import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (user?: any): ExecutionContext => {
    const request = { user };
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access when no roles metadata is defined', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when required roles list is empty', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has matching role', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      AdminRole.SUPER_ADMIN,
    ]);
    const context = createMockContext({
      id: 'admin-1',
      role: AdminRole.SUPER_ADMIN,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user is not present on request', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      AdminRole.SUPER_ADMIN,
    ]);
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user role does not match required roles', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      AdminRole.SUPER_ADMIN,
    ]);
    const context = createMockContext({
      id: 'admin-2',
      role: AdminRole.ADMIN,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
