import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Prisma,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransactionsService } from './transactions.service.js';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: {
    transaction: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
    user: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    transactionStatusHistory: {
      create: ReturnType<typeof vi.fn>;
    };
    activityLog: {
      create: ReturnType<typeof vi.fn>;
    };
    getNextSequenceValue: ReturnType<typeof vi.fn>;
    $transaction: ReturnType<typeof vi.fn>;
  };

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userCode: 'USR-0001',
    firstName: 'Sarah',
    lastName: 'Jenkins',
    email: 'sarah.jenkins@example.com',
    phone: '+1 555-014-2210',
    avatarUrl: 'https://avatar.url',
    role: UserRole.VIEWER,
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
  };

  const mockTransaction = {
    id: '223e4567-e89b-12d3-a456-426614174000',
    txnCode: 'TXN-0017',
    reference: 'ref_992743055',
    userId: mockUser.id,
    type: TransactionType.PAYMENT,
    status: TransactionStatus.COMPLETED,
    amount: new Prisma.Decimal('1250.00'),
    currency: 'USD',
    productName: 'iPhone 13 Pro',
    paymentMethod: 'Credit Card (Visa ending in 4582)',
    gatewayFee: new Prisma.Decimal('36.25'),
    subtotal: new Prisma.Decimal('1213.75'),
    total: new Prisma.Decimal('1250.00'),
    settledAt: new Date('2026-10-04T14:25:00.000Z'),
    createdAt: new Date('2026-10-04T14:20:00.000Z'),
    updatedAt: new Date('2026-10-04T14:25:00.000Z'),
    user: mockUser,
    statusHistory: [
      {
        id: 'h1',
        status: TransactionStatus.COMPLETED,
        note: 'Completed & Disbursed to merchant account',
        createdAt: new Date('2026-10-04T14:25:00.000Z'),
        adminId: 'admin-1',
        admin: { name: 'Admin User' },
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      transaction: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        aggregate: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
      transactionStatusHistory: {
        create: vi.fn(),
      },
      activityLog: {
        create: vi.fn(),
      },
      getNextSequenceValue: vi.fn(),
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  describe('findAll', () => {
    it('should return paginated transactions with summary mapping and metadata', async () => {
      prisma.transaction.findMany.mockResolvedValue([mockTransaction]);
      prisma.transaction.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].txnCode).toBe('TXN-0017');
      expect(result.data[0].customerName).toBe('Sarah Jenkins');
      expect(result.data[0].amount).toBe(1250.0);
      expect(result.data[0].gatewayFee).toBe(36.25);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('should apply multi-field search condition when search is provided', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findAll({ search: 'sarah' });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { txnCode: { contains: 'sarah', mode: 'insensitive' } },
              {
                user: { firstName: { contains: 'sarah', mode: 'insensitive' } },
              },
            ]),
          }),
        }),
      );
    });

    it('should normalize frontend status alias "paid" to COMPLETED', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findAll({ status: 'paid' });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: TransactionStatus.COMPLETED,
          }),
        }),
      );
    });

    it('should validate date range and throw BadRequestException if dateFrom > dateTo', async () => {
      await expect(
        service.findAll({
          dateFrom: '2026-10-10',
          dateTo: '2026-10-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStats', () => {
    it('should compute overview statistics with Decimal aggregations and success rate', async () => {
      prisma.transaction.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85) // completed
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(5) // failed
        .mockResolvedValueOnce(0); // refunded

      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('102819.00') },
        _avg: { amount: new Prisma.Decimal('1209.64') },
      });

      const stats = await service.getStats();

      expect(stats.total).toBe(100);
      expect(stats.completedCount).toBe(85);
      expect(stats.pendingCount).toBe(10);
      expect(stats.failedCount).toBe(5);
      expect(stats.revenue).toBe(102819.0);
      expect(stats.avg).toBe(1209.64);
      expect(stats.successRate).toBe(94.4); // 85 / (85 + 5) = 94.4%
    });
  });

  describe('findOne', () => {
    it('should return full transaction detail when resolved by business code', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction);
      prisma.transaction.findMany.mockResolvedValue([
        {
          id: 'ledger-1',
          txnCode: 'TXN-0010',
          paymentMethod: 'Credit Card (Visa ending in 4582)',
          amount: new Prisma.Decimal('120.00'),
          status: TransactionStatus.COMPLETED,
          settledAt: new Date('2026-08-15T10:14:00.000Z'),
          createdAt: new Date('2026-08-15T10:00:00.000Z'),
        },
      ]);

      const detail = await service.findOne('TXN-0017');

      expect(detail.txnCode).toBe('TXN-0017');
      expect(detail.customer.name).toBe('Sarah Jenkins');
      expect(detail.statusHistory).toHaveLength(1);
      expect(detail.relatedLedger).toHaveLength(1);
      expect(detail.relatedLedger[0].txnCode).toBe('TXN-0010');
      expect(detail.relatedLedger[0].amount).toBe(120.0);
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne('TXN-9999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should throw NotFoundException if target customer does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            userId: 'invalid-user',
            amount: 100,
            productName: 'Service',
            paymentMethod: 'Visa',
          },
          'admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if reference collision occurs', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      await expect(
        service.create(
          {
            userId: mockUser.id,
            amount: 100,
            productName: 'Service',
            paymentMethod: 'Visa',
            reference: 'ref_992743055',
          },
          'admin-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should atomically generate sequence code, calculate fees with Decimal, and create logs', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.getNextSequenceValue.mockResolvedValue(121);
      prisma.transaction.create.mockResolvedValue({
        ...mockTransaction,
        txnCode: 'TXN-0121',
        amount: new Prisma.Decimal('200.00'),
        gatewayFee: new Prisma.Decimal('5.80'),
        subtotal: new Prisma.Decimal('194.20'),
        total: new Prisma.Decimal('200.00'),
        status: TransactionStatus.PENDING,
        settledAt: null,
      });

      const result = await service.create(
        {
          userId: mockUser.id,
          amount: 200.0,
          productName: 'Consultation',
          paymentMethod: 'Credit Card',
        },
        'admin-1',
      );

      expect(prisma.getNextSequenceValue).toHaveBeenCalledWith('txn_code_seq');
      expect(prisma.transactionStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: 'admin-1',
            status: TransactionStatus.PENDING,
          }),
        }),
      );
      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'TRANSACTION_CREATED',
          }),
        }),
      );
      expect(result.txnCode).toBe('TXN-0121');
    });
  });

  describe('updateStatus', () => {
    it('should allow valid transition PENDING -> COMPLETED and set settledAt', async () => {
      const pendingTxn = {
        ...mockTransaction,
        status: TransactionStatus.PENDING,
        settledAt: null,
      };

      prisma.transaction.findFirst
        .mockResolvedValueOnce(pendingTxn) // for findTransactionRecord
        .mockResolvedValueOnce({
          ...mockTransaction,
          status: TransactionStatus.COMPLETED,
        }); // for subsequent findOne
      prisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.updateStatus(
        pendingTxn.id,
        {
          status: TransactionStatus.COMPLETED,
          note: 'Funds verified by bank',
        },
        'admin-1',
      );

      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: pendingTxn.id },
          data: expect.objectContaining({
            status: TransactionStatus.COMPLETED,
            settledAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.transactionStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: 'admin-1',
            status: TransactionStatus.COMPLETED,
            note: 'Funds verified by bank',
          }),
        }),
      );
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });

    it('should reject invalid lifecycle transition from COMPLETED to FAILED with BadRequestException', async () => {
      prisma.transaction.findFirst.mockResolvedValue(mockTransaction); // status: COMPLETED

      await expect(
        service.updateStatus(
          mockTransaction.id,
          {
            status: TransactionStatus.FAILED,
            note: 'Late failure',
          },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject any transition from terminal REFUNDED status with BadRequestException', async () => {
      const refundedTxn = {
        ...mockTransaction,
        status: TransactionStatus.REFUNDED,
      };
      prisma.transaction.findFirst.mockResolvedValue(refundedTxn);

      await expect(
        service.updateStatus(
          refundedTxn.id,
          {
            status: TransactionStatus.COMPLETED,
            note: 'Undo refund',
          },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
