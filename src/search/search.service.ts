import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { toDecimalNumber } from '../common/utils/decimal.util.js';
import {
  GlobalSearchResponseDto,
  SearchBookingResultDto,
  SearchTransactionResultDto,
  SearchUserResultDto,
} from './dto/search-response.dto.js';
import { SearchQueryDto } from './dto/search-query.dto.js';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Performs concurrent unified search across users, transactions, and service bookings.
   */
  async search(query: SearchQueryDto): Promise<GlobalSearchResponseDto> {
    const term = query.q.trim();
    const limit = query.limit || 5;

    if (!term) {
      return {
        query: term,
        totalMatches: 0,
        users: [],
        transactions: [],
        bookings: [],
      };
    }

    const [rawUsers, rawTransactions, rawBookings] = await Promise.all([
      // 1. Search Users (active non-deleted)
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { userCode: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),

      // 2. Search Transactions
      this.prisma.transaction.findMany({
        where: {
          OR: [
            { txnCode: { contains: term, mode: 'insensitive' } },
            { reference: { contains: term, mode: 'insensitive' } },
            { productName: { contains: term, mode: 'insensitive' } },
            { user: { firstName: { contains: term, mode: 'insensitive' } } },
            { user: { lastName: { contains: term, mode: 'insensitive' } } },
          ],
        },
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),

      // 3. Search Bookings
      this.prisma.booking.findMany({
        where: {
          OR: [
            { bookingCode: { contains: term, mode: 'insensitive' } },
            { invoiceCode: { contains: term, mode: 'insensitive' } },
            { serviceName: { contains: term, mode: 'insensitive' } },
            { user: { firstName: { contains: term, mode: 'insensitive' } } },
            { user: { lastName: { contains: term, mode: 'insensitive' } } },
          ],
        },
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
        take: limit,
        orderBy: { scheduledAt: 'desc' },
      }),
    ]);

    const users: SearchUserResultDto[] = rawUsers.map((u) => ({
      id: u.id,
      userCode: u.userCode,
      name: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      role: u.role,
      status: u.status,
    }));

    const transactions: SearchTransactionResultDto[] = rawTransactions.map((t) => ({
      id: t.id,
      txnCode: t.txnCode,
      customerName: t.user ? `${t.user.firstName} ${t.user.lastName}`.trim() : 'Unknown Customer',
      amount: toDecimalNumber(t.amount),
      status: t.status,
      type: t.type,
    }));

    const bookings: SearchBookingResultDto[] = rawBookings.map((b) => ({
      id: b.id,
      bookingCode: b.bookingCode,
      customerName: b.user ? `${b.user.firstName} ${b.user.lastName}`.trim() : 'Unknown Customer',
      serviceName: b.serviceName,
      scheduledAt: b.scheduledAt.toISOString(),
      status: b.status,
    }));

    return {
      query: term,
      totalMatches: users.length + transactions.length + bookings.length,
      users,
      transactions,
      bookings,
    };
  }
}
