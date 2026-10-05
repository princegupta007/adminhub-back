import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  const createMockContext = () => {
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({}),
      }),
    } as unknown as ExecutionContext;
  };

  it('should bypass authentication when route is marked with @Public()', () => {
    const context = createMockContext();
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException when token is expired (TokenExpiredError)', () => {
    const context = createMockContext();
    const expiredError = new Error('jwt expired');
    expiredError.name = 'TokenExpiredError';

    expect(() =>
      guard.handleRequest(null, null, expiredError, context),
    ).toThrowError(new UnauthorizedException('Token has expired'));
  });

  it('should throw UnauthorizedException when token is invalid or malformed (JsonWebTokenError)', () => {
    const context = createMockContext();
    const invalidError = new Error('invalid signature');
    invalidError.name = 'JsonWebTokenError';

    expect(() =>
      guard.handleRequest(null, null, invalidError, context),
    ).toThrowError(new UnauthorizedException('Invalid or malformed token'));
  });

  it('should throw UnauthorizedException when token is completely missing', () => {
    const context = createMockContext();

    expect(() =>
      guard.handleRequest(null, null, undefined, context),
    ).toThrowError(new UnauthorizedException('Authentication token required'));
  });

  it('should return authenticated user when authentication succeeds', () => {
    const context = createMockContext();
    const mockUser = { id: 'admin-1', email: 'admin@miles.io' };

    const result = guard.handleRequest(null, mockUser, undefined, context);

    expect(result).toBe(mockUser);
  });
});
