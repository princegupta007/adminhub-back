import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Admin,
  Prisma,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
} from '@prisma/client';
import { createPaginationMeta } from '../common/utils/pagination.util.js';
import { toDecimalNumber } from '../common/utils/decimal.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import {
  TransactionDetailResponseDto,
  TransactionStatusHistoryEntryDto,
} from './dto/transaction-detail-response.dto.js';
import {
  PaginatedTransactionsResponseDto,
  TransactionSummaryDto,
} from './dto/transaction-response.dto.js';
import { TransactionStatsDto } from './dto/transaction-stats-response.dto.js';
import { TransactionsQueryDto } from './dto/transactions-query.dto.js';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto.js';
import { RefundTransactionDto } from './dto/refund-transaction.dto.js';
import { formatToCsv } from '../common/utils/csv.util.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_STATUS_TRANSITIONS: Record<
  TransactionStatus,
  readonly TransactionStatus[]
> = {
  [TransactionStatus.PENDING]: [
    TransactionStatus.COMPLETED,
    TransactionStatus.FAILED,
    TransactionStatus.REFUNDED,
  ],
  [TransactionStatus.COMPLETED]: [TransactionStatus.REFUNDED],
  [TransactionStatus.FAILED]: [TransactionStatus.PENDING],
  [TransactionStatus.REFUNDED]: [],
};

type TransactionWithUser = Transaction & {
  user: User;
};

type TransactionFullDetail = Transaction & {
  user: User;
  statusHistory: Array<{
    id: string;
    status: TransactionStatus;
    note: string;
    createdAt: Date;
    adminId: string | null;
    admin: Admin | null;
  }>;
};

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Serializes a database transaction row with joined user into TransactionSummaryDto.
   */
  private mapToSummary(txn: TransactionWithUser): TransactionSummaryDto {
    const customerName = `${txn.user.firstName} ${txn.user.lastName}`.trim();

    return {
      id: txn.id,
      txnCode: txn.txnCode,
      reference: txn.reference,
      userId: txn.userId,
      customerName: customerName || `Customer #${txn.user.userCode}`,
      customerEmail: txn.user.email ?? null,
      customerAvatar: txn.user.avatarUrl ?? null,
      type: txn.type,
      status: txn.status,
      amount: toDecimalNumber(txn.amount),
      currency: txn.currency,
      productName: txn.productName,
      paymentMethod: txn.paymentMethod,
      gatewayFee: toDecimalNumber(txn.gatewayFee),
      subtotal: toDecimalNumber(txn.subtotal),
      total: toDecimalNumber(txn.total),
      settledAt: txn.settledAt ? txn.settledAt.toISOString() : null,
      createdAt: txn.createdAt.toISOString(),
      updatedAt: txn.updatedAt.toISOString(),
    };
  }

  /**
   * Maps public sort fields to Prisma OrderByInput array with deterministic tie-breaker.
   */
  private buildOrderBy(
    sortBy?: string,
    direction?: string,
  ): Prisma.TransactionOrderByWithRelationInput[] {
    const dir = direction?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    switch (sortBy) {
      case 'amount':
        return [{ amount: dir }, { id: 'asc' }];
      case 'total':
        return [{ total: dir }, { id: 'asc' }];
      case 'txnCode':
      case 'id':
        return [{ txnCode: dir }, { id: 'asc' }];
      case 'status':
        return [{ status: dir }, { id: 'asc' }];
      case 'type':
        return [{ type: dir }, { id: 'asc' }];
      case 'customerName':
      case 'user':
        return [{ user: { firstName: dir } }, { id: 'asc' }];
      case 'date':
      case 'createdAt':
      default:
        return [{ createdAt: dir }, { id: 'asc' }];
    }
  }

  /**
   * Resolves transaction record by UUID or business code (TXN-XXXX).
   */
  private async findTransactionRecord(
    idOrCode: string,
  ): Promise<TransactionWithUser> {
    const isUuid = UUID_REGEX.test(idOrCode);
    const where: Prisma.TransactionWhereInput = isUuid
      ? { id: idOrCode }
      : { txnCode: idOrCode };

    const transaction = await this.prisma.transaction.findFirst({
      where,
      include: { user: true },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction '${idOrCode}' was not found in the ledger`,
      );
    }

    return transaction;
  }

  /**
   * Normalizes status string (supporting 'paid' -> COMPLETED alias from frontend).
   */
  private normalizeStatus(statusStr?: string): TransactionStatus | undefined {
    if (!statusStr) return undefined;
    const lower = statusStr.trim().toLowerCase();
    if (lower === 'all') return undefined;
    if (lower === 'paid') return TransactionStatus.COMPLETED;
    const upper = statusStr.trim().toUpperCase();
    if (Object.values(TransactionStatus).includes(upper as TransactionStatus)) {
      return upper as TransactionStatus;
    }
    return undefined;
  }

  /**
   * Normalizes transaction type string.
   */
  private normalizeType(typeStr?: string): TransactionType | undefined {
    if (!typeStr) return undefined;
    const lower = typeStr.trim().toLowerCase();
    if (lower === 'all') return undefined;
    const upper = typeStr.trim().toUpperCase();
    if (Object.values(TransactionType).includes(upper as TransactionType)) {
      return upper as TransactionType;
    }
    return undefined;
  }

  /**
   * Builds Prisma where filter object from query DTO.
   */
  private buildWhere(query: TransactionsQueryDto): Prisma.TransactionWhereInput {
    const searchTerm = (query.q ?? query.search)?.trim();
    const normalizedStatus = this.normalizeStatus(query.status);
    const normalizedType = this.normalizeType(query.type);

    const where: Prisma.TransactionWhereInput = {};

    // 1. Multi-field search
    if (searchTerm) {
      where.OR = [
        { txnCode: { contains: searchTerm, mode: 'insensitive' } },
        { reference: { contains: searchTerm, mode: 'insensitive' } },
        { productName: { contains: searchTerm, mode: 'insensitive' } },
        { paymentMethod: { contains: searchTerm, mode: 'insensitive' } },
        { user: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { userCode: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    // 2. Status filter
    if (normalizedStatus) {
      where.status = normalizedStatus;
    }

    // 3. Type filter
    if (normalizedType) {
      where.type = normalizedType;
    }

    // 4. Payment method filter
    if (query.paymentMethod && query.paymentMethod !== 'all') {
      where.paymentMethod = {
        contains: query.paymentMethod.trim(),
        mode: 'insensitive',
      };
    }

    // 5. User filter
    if (query.userId) {
      const isUserUuid = UUID_REGEX.test(query.userId);
      if (isUserUuid) {
        where.userId = query.userId;
      } else {
        where.user = { userCode: query.userId.trim() };
      }
    }

    // 6. Amount bounds
    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      where.amount = {};
      if (query.minAmount !== undefined) {
        where.amount.gte = new Prisma.Decimal(query.minAmount.toFixed(2));
      }
      if (query.maxAmount !== undefined) {
        where.amount.lte = new Prisma.Decimal(query.maxAmount.toFixed(2));
      }
    }

    // 7. Date filtering (presets or explicit ISO range)
    if (query.date && query.date !== 'all') {
      const days = parseInt(query.date, 10);
      if (!Number.isNaN(days) && days > 0) {
        const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        where.createdAt = { gte: threshold };
      }
    } else if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        const fromDate = new Date(query.dateFrom);
        if (Number.isNaN(fromDate.getTime())) {
          throw new BadRequestException('Invalid dateFrom parameter');
        }
        where.createdAt.gte = fromDate;
      }
      if (query.dateTo) {
        const toDate = new Date(query.dateTo);
        if (Number.isNaN(toDate.getTime())) {
          throw new BadRequestException('Invalid dateTo parameter');
        }
        // Inclusive end of day
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }

      if (
        where.createdAt.gte &&
        where.createdAt.lte &&
        where.createdAt.gte > where.createdAt.lte
      ) {
        throw new BadRequestException(
          'dateFrom must be before or equal to dateTo',
        );
      }
    }

    return where;
  }

  /**
   * List paginated transactions with multi-field search, filters, and whitelist sorting.
   */
  async findAll(
    query: TransactionsQueryDto,
  ): Promise<PaginatedTransactionsResponseDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;

    const where = this.buildWhere(query);
    const sortDirection = query.sortOrder ?? query.order ?? 'desc';
    const orderBy = this.buildOrderBy(query.sortBy, sortDirection);

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { user: true },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    const data = transactions.map((txn) => this.mapToSummary(txn));

    return {
      data,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  /**
   * Retrieves high-level transactions overview metrics for the top stat cards.
   */
  async getStats(): Promise<TransactionStatsDto> {
    const [
      total,
      completedCount,
      pendingCount,
      failedCount,
      refundedCount,
      revenueAgg,
    ] = await Promise.all([
      this.prisma.transaction.count(),
      this.prisma.transaction.count({
        where: { status: TransactionStatus.COMPLETED },
      }),
      this.prisma.transaction.count({
        where: { status: TransactionStatus.PENDING },
      }),
      this.prisma.transaction.count({
        where: { status: TransactionStatus.FAILED },
      }),
      this.prisma.transaction.count({
        where: { status: TransactionStatus.REFUNDED },
      }),
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.COMPLETED },
        _sum: { amount: true },
        _avg: { amount: true },
      }),
    ]);

    const revenueDecimal = revenueAgg._sum.amount ?? new Prisma.Decimal(0);
    const revenueNumber = toDecimalNumber(revenueDecimal);

    const avgDecimal = revenueAgg._avg.amount ?? new Prisma.Decimal(0);
    const avgNumber = toDecimalNumber(avgDecimal);

    // Success rate calculated across completed vs all terminal transactions
    const terminalCount = completedCount + failedCount;
    const successRate =
      terminalCount > 0
        ? Number(((completedCount / terminalCount) * 100).toFixed(1))
        : 100.0;

    return {
      total,
      revenue: revenueNumber,
      avg: avgNumber,
      pendingCount,
      successRate,
      completedCount,
      failedCount,
      refundedCount,
    };
  }

  /**
   * Fetches full transaction details including customer info, status history, and related ledger.
   */
  async findOne(idOrCode: string): Promise<TransactionDetailResponseDto> {
    const isUuid = UUID_REGEX.test(idOrCode);
    const where: Prisma.TransactionWhereInput = isUuid
      ? { id: idOrCode }
      : { txnCode: idOrCode };

    const transaction = (await this.prisma.transaction.findFirst({
      where,
      include: {
        user: true,
        statusHistory: {
          include: { admin: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })) as TransactionFullDetail | null;

    if (!transaction) {
      throw new NotFoundException(
        `Transaction '${idOrCode}' was not found in the ledger`,
      );
    }

    // Fetch related ledger entries for this user (bounded to 5 items, excluding current transaction)
    const relatedLedgerEntries = await this.prisma.transaction.findMany({
      where: {
        userId: transaction.userId,
        id: { not: transaction.id },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        txnCode: true,
        paymentMethod: true,
        amount: true,
        status: true,
        settledAt: true,
        createdAt: true,
      },
    });

    const statusHistory: TransactionStatusHistoryEntryDto[] =
      transaction.statusHistory.map((item) => ({
        id: item.id,
        status: item.status,
        note: item.note,
        adminId: item.adminId,
        adminName: item.admin?.name ?? null,
        createdAt: item.createdAt.toISOString(),
      }));

    const relatedLedger = relatedLedgerEntries.map((item) => ({
      id: item.id,
      txnCode: item.txnCode,
      paymentMethod: item.paymentMethod,
      amount: toDecimalNumber(item.amount),
      status: item.status,
      settledAt: item.settledAt ? item.settledAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
    }));

    return {
      id: transaction.id,
      txnCode: transaction.txnCode,
      reference: transaction.reference,
      type: transaction.type,
      status: transaction.status,
      amount: toDecimalNumber(transaction.amount),
      currency: transaction.currency,
      productName: transaction.productName,
      paymentMethod: transaction.paymentMethod,
      gatewayFee: toDecimalNumber(transaction.gatewayFee),
      subtotal: toDecimalNumber(transaction.subtotal),
      total: toDecimalNumber(transaction.total),
      settledAt: transaction.settledAt
        ? transaction.settledAt.toISOString()
        : null,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
      customer: {
        id: transaction.user.id,
        userCode: transaction.user.userCode,
        name: `${transaction.user.firstName} ${transaction.user.lastName}`.trim(),
        firstName: transaction.user.firstName,
        lastName: transaction.user.lastName,
        email: transaction.user.email,
        phone: transaction.user.phone,
        avatarUrl: transaction.user.avatarUrl,
      },
      statusHistory,
      relatedLedger,
    };
  }

  /**
   * Creates a transaction with atomic sequence generation and audit logs.
   */
  async create(
    dto: CreateTransactionDto,
    adminId: string,
  ): Promise<TransactionSummaryDto> {
    // 1. Verify target customer exists and is not soft-deleted
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(
        `Customer user '${dto.userId}' does not exist or has been deleted`,
      );
    }

    // 2. Check reference conflict if explicitly supplied
    if (dto.reference?.trim()) {
      const existingRef = await this.prisma.transaction.findUnique({
        where: { reference: dto.reference.trim() },
      });
      if (existingRef) {
        throw new ConflictException(
          `Transaction with reference '${dto.reference.trim()}' already exists`,
        );
      }
    }

    // 3. Atomically generate sequence-based business transaction code
    const seq = await this.prisma.getNextSequenceValue('txn_code_seq');
    const txnCode = `TXN-${seq.toString().padStart(4, '0')}`;
    const reference = dto.reference?.trim() || `ref_${Date.now()}_${seq}`;

    // 4. Financial calculations using Prisma Decimal arithmetic
    const amountDecimal = new Prisma.Decimal(dto.amount.toFixed(2));
    const feeDecimal =
      dto.gatewayFee !== undefined
        ? new Prisma.Decimal(dto.gatewayFee.toFixed(2))
        : amountDecimal.mul(new Prisma.Decimal('0.029')).toDecimalPlaces(2);
    const subtotalDecimal =
      dto.subtotal !== undefined
        ? new Prisma.Decimal(dto.subtotal.toFixed(2))
        : amountDecimal.minus(feeDecimal).toDecimalPlaces(2);
    const totalDecimal =
      dto.total !== undefined
        ? new Prisma.Decimal(dto.total.toFixed(2))
        : amountDecimal;

    const initialStatus = dto.status ?? TransactionStatus.PENDING;
    const settledAt =
      initialStatus === TransactionStatus.COMPLETED ? new Date() : null;

    // 5. Execute in atomic transaction
    const createdTxn = await this.prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          txnCode,
          reference,
          userId: user.id,
          type: dto.type ?? TransactionType.PAYMENT,
          status: initialStatus,
          amount: totalDecimal,
          currency: dto.currency ?? 'USD',
          productName: dto.productName.trim(),
          paymentMethod: dto.paymentMethod.trim(),
          gatewayFee: feeDecimal,
          subtotal: subtotalDecimal,
          total: totalDecimal,
          settledAt,
        },
        include: { user: true },
      });

      // Initial status history log
      await tx.transactionStatusHistory.create({
        data: {
          transactionId: txn.id,
          adminId,
          status: initialStatus,
          note: 'Transaction record initialized',
        },
      });

      // Activity log entry for user audit trail
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: 'TRANSACTION_CREATED',
          description: `Transaction ${txnCode} created for user ${user.firstName} ${user.lastName} with amount $${totalDecimal.toFixed(2)} (${initialStatus}).`,
        },
      });

      return txn;
    });

    return this.mapToSummary(createdTxn);
  }

  /**
   * Updates transaction status adhering strictly to status lifecycle state machine.
   */
  async updateStatus(
    idOrCode: string,
    dto: UpdateTransactionStatusDto,
    adminId: string,
  ): Promise<TransactionDetailResponseDto> {
    const existing = await this.findTransactionRecord(idOrCode);
    const currentStatus = existing.status;
    const targetStatus = dto.status;

    // Validate lifecycle transition if status is changing
    if (currentStatus !== targetStatus) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus];
      if (!allowed.includes(targetStatus)) {
        throw new BadRequestException(
          `Invalid transaction status transition from ${currentStatus} to ${targetStatus}. Allowed transitions: ${
            allowed.length > 0 ? allowed.join(', ') : 'None (Terminal state)'
          }`,
        );
      }
    }

    // Set settlement timestamp if transitioning to COMPLETED
    const settledAt =
      targetStatus === TransactionStatus.COMPLETED && !existing.settledAt
        ? new Date()
        : existing.settledAt;

    await this.prisma.$transaction(async (tx) => {
      // 1. Update status and settlement timestamp
      await tx.transaction.update({
        where: { id: existing.id },
        data: {
          status: targetStatus,
          settledAt,
        },
      });

      // 2. Append history entry
      await tx.transactionStatusHistory.create({
        data: {
          transactionId: existing.id,
          adminId,
          status: targetStatus,
          note: dto.note.trim(),
        },
      });

      // 3. Append activity log
      await tx.activityLog.create({
        data: {
          userId: existing.userId,
          action: 'TRANSACTION_STATUS_UPDATED',
          description: `Transaction ${existing.txnCode} status changed from ${currentStatus} to ${targetStatus}. Note: ${dto.note.trim()}`,
        },
      });
    });

    return this.findOne(existing.id);
  }

  /**
   * Generates RFC 4180 CSV export matching filter and search query parameters.
   */
  async exportCsv(query: TransactionsQueryDto): Promise<string> {
    const where = this.buildWhere(query);
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder ?? query.order ?? 'desc';
    const orderBy = this.buildOrderBy(sortField, sortOrder);

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy,
      include: { user: true },
      take: 2000,
    });

    const headers = [
      'Transaction Code',
      'Reference',
      'Customer Name',
      'Customer Email',
      'Type',
      'Status',
      'Amount ($)',
      'Currency',
      'Payment Method',
      'Gateway Fee ($)',
      'Subtotal ($)',
      'Total ($)',
      'Created At',
      'Settled At',
    ];

    const rows = transactions.map((t) => [
      t.txnCode,
      t.reference,
      t.user ? `${t.user.firstName} ${t.user.lastName}`.trim() : 'Unknown',
      t.user?.email || '',
      t.type,
      t.status,
      toDecimalNumber(t.amount),
      t.currency,
      t.paymentMethod,
      toDecimalNumber(t.gatewayFee),
      toDecimalNumber(t.subtotal),
      toDecimalNumber(t.total),
      t.createdAt.toISOString(),
      t.settledAt ? t.settledAt.toISOString() : '',
    ]);

    return formatToCsv(headers, rows);
  }

  /**
   * Issues refund on an eligible transaction and generates audit timeline history.
   */
  async refund(
    idOrCode: string,
    dto: RefundTransactionDto,
    adminId: string,
  ): Promise<TransactionDetailResponseDto> {
    const existing = await this.findTransactionRecord(idOrCode);

    if (existing.status === TransactionStatus.REFUNDED) {
      throw new BadRequestException('Transaction is already refunded');
    }

    if (existing.status === TransactionStatus.FAILED) {
      throw new BadRequestException('Cannot refund a failed transaction');
    }

    const note = dto.reason?.trim()
      ? `Refund processed: ${dto.reason.trim()}`
      : 'Refund processed by administrator';

    await this.prisma.$transaction(async (tx) => {
      // 1. Update transaction status
      await tx.transaction.update({
        where: { id: existing.id },
        data: {
          status: TransactionStatus.REFUNDED,
        },
      });

      // 2. Append history entry
      await tx.transactionStatusHistory.create({
        data: {
          transactionId: existing.id,
          adminId,
          status: TransactionStatus.REFUNDED,
          note,
        },
      });

      // 3. Append activity log
      await tx.activityLog.create({
        data: {
          userId: existing.userId,
          action: 'TRANSACTION_REFUNDED',
          description: `Refund processed for transaction ${existing.txnCode}. Reason: ${dto.reason?.trim() || 'Administrator action'}`,
        },
      });
    });

    return this.findOne(existing.id);
  }
}
