import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchService } from './search.service.js';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: vi.fn(),
      },
      transaction: {
        findMany: vi.fn(),
      },
      booking: {
        findMany: vi.fn(),
      },
    } as unknown as PrismaService;

    service = new SearchService(prisma);
  });

  it('should return empty matches if query string is empty', async () => {
    const res = await service.search({ q: '   ', limit: 5 });
    expect(res.totalMatches).toBe(0);
    expect(res.users).toEqual([]);
    expect(res.transactions).toEqual([]);
    expect(res.bookings).toEqual([]);
  });

  it('should search users, transactions, and bookings concurrently and aggregate results', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      {
        id: 'u-1',
        userCode: 'USR-0001',
        firstName: 'Sarah',
        lastName: 'Jenkins',
        email: 'sarah@example.com',
        role: 'ADMIN',
        status: 'ACTIVE',
      } as any,
    ]);

    vi.mocked(prisma.transaction.findMany).mockResolvedValueOnce([
      {
        id: 't-1',
        txnCode: 'TXN-0017',
        amount: 1250,
        status: 'COMPLETED',
        type: 'PAYMENT',
        user: { firstName: 'Sarah', lastName: 'Jenkins' },
      } as any,
    ]);

    vi.mocked(prisma.booking.findMany).mockResolvedValueOnce([
      {
        id: 'b-1',
        bookingCode: 'BKG-0045',
        serviceName: 'Home Cleaning',
        scheduledAt: new Date('2026-10-15T10:00:00.000Z'),
        status: 'CONFIRMED',
        user: { firstName: 'Sarah', lastName: 'Jenkins' },
      } as any,
    ]);

    const res = await service.search({ q: 'Sarah', limit: 5 });

    expect(res.query).toBe('Sarah');
    expect(res.totalMatches).toBe(3);
    expect(res.users).toHaveLength(1);
    expect(res.users[0].userCode).toBe('USR-0001');
    expect(res.users[0].name).toBe('Sarah Jenkins');

    expect(res.transactions).toHaveLength(1);
    expect(res.transactions[0].txnCode).toBe('TXN-0017');
    expect(res.transactions[0].customerName).toBe('Sarah Jenkins');
    expect(res.transactions[0].amount).toBe(1250);

    expect(res.bookings).toHaveLength(1);
    expect(res.bookings[0].bookingCode).toBe('BKG-0045');
    expect(res.bookings[0].customerName).toBe('Sarah Jenkins');
    expect(res.bookings[0].scheduledAt).toBe('2026-10-15T10:00:00.000Z');
  });
});
