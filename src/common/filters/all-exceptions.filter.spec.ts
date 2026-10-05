import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AllExceptionsFilter,
  StandardErrorResponse,
} from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  let mockRequest: {
    url: string;
    method: string;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockRequest = {
      url: '/api/v1/test',
      method: 'POST',
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should correctly format BadRequestException (400)', () => {
    const exception = new BadRequestException(['email must be an email']);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const sentData = mockResponse.json.mock
      .calls[0][0] as StandardErrorResponse;
    expect(sentData.statusCode).toBe(400);
    expect(sentData.message).toEqual(['email must be an email']);
    expect(sentData.error).toBe('Bad Request');
    expect(sentData.path).toBe('/api/v1/test');
    expect(sentData.timestamp).toBeDefined();
  });

  it('should correctly format UnauthorizedException (401)', () => {
    const exception = new UnauthorizedException('Invalid email or password');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    const sentData = mockResponse.json.mock
      .calls[0][0] as StandardErrorResponse;
    expect(sentData.statusCode).toBe(401);
    expect(sentData.message).toBe('Invalid email or password');
    expect(sentData.error).toBe('Unauthorized');
  });

  it('should format 500 without leaking stack trace or internal database details', () => {
    const sensitiveError = new Error(
      'FATAL: password authentication failed for user "postgres"',
    );
    sensitiveError.stack =
      'Secret stack trace at line 42 with postgres credentials';

    filter.catch(sensitiveError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const sentData = mockResponse.json.mock
      .calls[0][0] as StandardErrorResponse;
    expect(sentData.statusCode).toBe(500);
    expect(sentData.message).toBe('Internal server error');
    expect(sentData.error).toBe('Internal Server Error');
    expect(JSON.stringify(sentData)).not.toContain('postgres');
    expect(JSON.stringify(sentData)).not.toContain('stack trace');
  });

  it('should map Prisma P2002 unique constraint error to 409 Conflict', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      {
        code: 'P2002',
        clientVersion: '6.4.1',
        meta: { target: ['email'] },
      },
    );

    filter.catch(prismaError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    const sentData = mockResponse.json.mock
      .calls[0][0] as StandardErrorResponse;
    expect(sentData.statusCode).toBe(409);
    expect(sentData.error).toBe('Conflict');
    expect(sentData.message).toContain('email');
  });

  it('should map Prisma P2025 record not found to 404 Not Found', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Record to update not found',
      {
        code: 'P2025',
        clientVersion: '6.4.1',
        meta: { cause: 'Record to update not found' },
      },
    );

    filter.catch(prismaError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const sentData = mockResponse.json.mock
      .calls[0][0] as StandardErrorResponse;
    expect(sentData.statusCode).toBe(404);
    expect(sentData.error).toBe('Not Found');
  });
});
