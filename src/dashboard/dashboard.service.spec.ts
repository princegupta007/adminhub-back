import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AlertSeverity,
  BookingStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    user: {
      count: ReturnType<typeof vi.fn>;
    };
    transaction: {
      aggregate: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    booking: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    alert: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        count: vi.fn(),
      },
      transaction: {
        aggregate: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
        groupBy: vi.fn(),
      },
      booking: {
        count: vi.fn(),
        findMany: vi.fn(),
        groupBy: vi.fn(),
      },
      alert: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getStats()', () => {
    it('should calculate 4 primary KPI cards and system totals with accurate precision', async () => {
      // 1. User counts
      prisma.user.count
        .mockResolvedValueOnce(150) // total users
        .mockResolvedValueOnce(25) // current window joined
        .mockResolvedValueOnce(20); // prev window joined

      // 2. Revenue aggregations
      prisma.transaction.aggregate
        .mockResolvedValueOnce({
          _sum: { amount: new Prisma.Decimal('50000.00') },
        }) // total revenue
        .mockResolvedValueOnce({
          _sum: { amount: new Prisma.Decimal('12000.00') },
        }) // current window revenue
        .mockResolvedValueOnce({
          _sum: { amount: new Prisma.Decimal('10000.00') },
        }); // prev window revenue

      // 3. Active bookings counts
      prisma.booking.count
        .mockResolvedValueOnce(45) // active bookings (CONFIRMED + PENDING)
        .mockResolvedValueOnce(30) // current window created
        .mockResolvedValueOnce(25); // prev window created

      // 4. Pending transactions
      prisma.transaction.count
        .mockResolvedValueOnce(8) // pending count
        .mockResolvedValueOnce(8) // current window pending
        .mockResolvedValueOnce(10); // prev window pending

      // 5. Totals
      prisma.transaction.aggregate.mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal('3500.00') },
      }); // pending revenue

      prisma.transaction.count
        .mockResolvedValueOnce(120) // total orders
        .mockResolvedValueOnce(100) // paid orders
        .mockResolvedValueOnce(8) // pending orders
        .mockResolvedValueOnce(12); // failed orders

      prisma.booking.count
        .mockResolvedValueOnce(60) // total bookings
        .mockResolvedValueOnce(35) // confirmed bookings
        .mockResolvedValueOnce(20) // completed bookings
        .mockResolvedValueOnce(5); // cancelled bookings

      const result = await service.getStats();

      expect(result.kpis).toHaveLength(4);

      // Verify Users KPI
      const usersKpi = result.kpis.find((k) => k.id === 'users');
      expect(usersKpi).toBeDefined();
      expect(usersKpi?.value).toBe(150);
      expect(usersKpi?.changePct).toBe(25.0); // ((25 - 20) / 20) * 100
      expect(usersKpi?.trend).toBe('up');

      // Verify Revenue KPI
      const revenueKpi = result.kpis.find((k) => k.id === 'revenue');
      expect(revenueKpi).toBeDefined();
      expect(revenueKpi?.value).toBe(50000.0);
      expect(revenueKpi?.changePct).toBe(20.0); // ((12000 - 10000) / 10000) * 100
      expect(revenueKpi?.trend).toBe('up');

      // Verify Active Bookings KPI
      const bookingsKpi = result.kpis.find((k) => k.id === 'bookings');
      expect(bookingsKpi).toBeDefined();
      expect(bookingsKpi?.value).toBe(45);
      expect(bookingsKpi?.changePct).toBe(20.0); // ((30 - 25) / 25) * 100
      expect(bookingsKpi?.trend).toBe('up');

      // Verify Pending Transactions KPI
      const pendingKpi = result.kpis.find((k) => k.id === 'pending');
      expect(pendingKpi).toBeDefined();
      expect(pendingKpi?.value).toBe(8);
      expect(pendingKpi?.changePct).toBe(-20.0); // ((8 - 10) / 10) * 100
      expect(pendingKpi?.trend).toBe('down');

      // Verify Totals
      expect(result.totals.revenue).toBe(50000.0);
      expect(result.totals.pendingRevenue).toBe(3500.0);
      expect(result.totals.orders).toBe(120);
      expect(result.totals.paidOrders).toBe(100);
      expect(result.totals.averageOrderValue).toBe(500.0); // 50000 / 100
      expect(result.totals.bookingSuccessRate).toBe(91.67); // ((60 - 5) / 60) * 100
    });
  });

  describe('getCharts()', () => {
    it('should generate continuous time-series and distributions for default 6m range', async () => {
      const sampleTxDate = new Date();
      prisma.transaction.findMany.mockResolvedValueOnce([
        {
          amount: new Prisma.Decimal('150.00'),
          status: TransactionStatus.COMPLETED,
          createdAt: sampleTxDate,
        },
      ]);

      prisma.transaction.groupBy
        .mockResolvedValueOnce([
          {
            status: TransactionStatus.COMPLETED,
            _count: { _all: 50 },
            _sum: { amount: new Prisma.Decimal('15000.00') },
          },
          {
            status: TransactionStatus.PENDING,
            _count: { _all: 5 },
            _sum: { amount: new Prisma.Decimal('1000.00') },
          },
        ]) // ordersByStatus
        .mockResolvedValueOnce([
          {
            productName: 'iPhone 13 Pro',
            _count: { _all: 25 },
            _sum: { amount: new Prisma.Decimal('25000.00') },
          },
        ]); // topProducts

      prisma.booking.groupBy
        .mockResolvedValueOnce([
          {
            status: BookingStatus.CONFIRMED,
            _count: { _all: 20 },
            _sum: { amount: new Prisma.Decimal('4000.00') },
          },
        ]) // bookingsByStatus
        .mockResolvedValueOnce([
          {
            category: 'Cleaning',
            _count: { _all: 15 },
            _sum: { amount: new Prisma.Decimal('2250.00') },
          },
        ]); // bookingsByCategory

      const result = await service.getCharts({ range: '6m' });

      expect(result.range).toBe('6m');
      expect(result.revenueByPeriod).toHaveLength(6);
      expect(result.revenueByMonth).toHaveLength(6);
      expect(result.ordersByStatus).toHaveLength(4);
      expect(result.bookingsByStatus).toHaveLength(4);
      expect(result.bookingsByCategory).toHaveLength(1);
      expect(result.topProducts).toHaveLength(1);

      const paidOrderSlice = result.ordersByStatus.find(
        (s) => s.status === 'COMPLETED',
      );
      expect(paidOrderSlice?.label).toBe('Paid');
      expect(paidOrderSlice?.count).toBe(50);
      expect(paidOrderSlice?.amount).toBe(15000.0);

      const topProduct = result.topProducts[0];
      expect(topProduct.title).toBe('iPhone 13 Pro');
      expect(topProduct.unitsSold).toBe(25);
      expect(topProduct.revenue).toBe(25000.0);
    });

    it('should generate 7 daily points for 7d range', async () => {
      prisma.transaction.findMany.mockResolvedValueOnce([]);
      prisma.transaction.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prisma.booking.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getCharts({ range: '7d' });
      expect(result.range).toBe('7d');
      expect(result.revenueByPeriod).toHaveLength(7);
    });
  });

  describe('getAlerts() & resolveAlert()', () => {
    it('should return active alerts formatted with severity tones', async () => {
      const mockDate = new Date(Date.now() - 3600000 * 2); // 2 hours ago
      prisma.alert.findMany.mockResolvedValueOnce([
        {
          id: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
          title: 'Server capacity at 92%',
          description: 'Scale compute resources',
          severity: AlertSeverity.CRITICAL,
          isResolved: false,
          createdAt: mockDate,
        },
      ]);

      const alerts = await service.getAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].title).toBe('Server capacity at 92%');
      expect(alerts[0].tone).toBe('danger');
      expect(alerts[0].time).toBe('2 hours ago');
    });

    it('should resolve an alert by ID', async () => {
      const alertId = 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b';
      prisma.alert.findUnique.mockResolvedValueOnce({
        id: alertId,
        title: 'Server Alert',
        isResolved: false,
      });
      prisma.alert.update.mockResolvedValueOnce({
        id: alertId,
        isResolved: true,
      });

      const result = await service.resolveAlert(alertId);
      expect(result.id).toBe(alertId);
      expect(result.isResolved).toBe(true);
      expect(result.message).toBe('Alert marked as resolved');
    });

    it('should throw NotFoundException if alert does not exist', async () => {
      prisma.alert.findUnique.mockResolvedValueOnce(null);

      await expect(service.resolveAlert('missing-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getHealth()', () => {
    it('should return system uptime and database connected status', async () => {
      prisma.user.count.mockResolvedValueOnce(50);
      prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

      const health = await service.getHealth();
      expect(health.uptime).toBe('99.8%');
      expect(health.database).toBe('connected');
      expect(typeof health.avgResponseTime).toBe('string');
      expect(health.activeSessions).toBeGreaterThan(0);
    });
  });

  describe('getRecentTransactions() & getUpcomingBookings()', () => {
    it('should return mapped recent transactions with customer profile', async () => {
      prisma.transaction.findMany.mockResolvedValueOnce([
        {
          id: 't1',
          txnCode: 'TXN-0001',
          reference: 'ref_123',
          userId: 'u1',
          type: TransactionType.PAYMENT,
          status: TransactionStatus.COMPLETED,
          amount: new Prisma.Decimal('120.00'),
          currency: 'USD',
          productName: 'Service A',
          paymentMethod: 'Credit Card',
          gatewayFee: new Prisma.Decimal('3.50'),
          subtotal: new Prisma.Decimal('116.50'),
          total: new Prisma.Decimal('120.00'),
          settledAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            firstName: 'Sarah',
            lastName: 'Jenkins',
            email: 'sarah@example.com',
            avatarUrl: null,
          },
        },
      ]);

      const txns = await service.getRecentTransactions(5);
      expect(txns).toHaveLength(1);
      expect(txns[0].txnCode).toBe('TXN-0001');
      expect(txns[0].customerName).toBe('Sarah Jenkins');
      expect(txns[0].amount).toBe(120.0);
    });

    it('should return mapped upcoming bookings with customer profile', async () => {
      prisma.booking.findMany.mockResolvedValueOnce([
        {
          id: 'b1',
          bookingCode: 'BKG-0001',
          userId: 'u1',
          serviceName: 'Cleaning',
          category: 'Home',
          scheduledAt: new Date(Date.now() + 86400000),
          durationHours: new Prisma.Decimal('2.00'),
          endTime: new Date(Date.now() + 86400000 + 7200000),
          location: 'HQ',
          status: BookingStatus.CONFIRMED,
          amount: new Prisma.Decimal('200.00'),
          paymentStatus: 'PAID',
          paymentMethod: 'Card',
          invoiceCode: 'INV-10001',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            avatarUrl: null,
          },
        },
      ]);

      const bkgs = await service.getUpcomingBookings(5);
      expect(bkgs).toHaveLength(1);
      expect(bkgs[0].bookingCode).toBe('BKG-0001');
      expect(bkgs[0].customerName).toBe('John Doe');
      expect(bkgs[0].amount).toBe(200.0);
    });
  });

  describe('getReports', () => {
    it('should aggregate monthly reports and compute totals accurately', async () => {
      const now = new Date();
      prisma.transaction.findMany.mockResolvedValueOnce([
        {
          amount: new Prisma.Decimal('150.00'),
          status: TransactionStatus.COMPLETED,
          createdAt: now,
        },
        {
          amount: new Prisma.Decimal('50.00'),
          status: TransactionStatus.PENDING,
          createdAt: now,
        },
      ]);

      const reports = await service.getReports();

      expect(reports.rows).toHaveLength(12);
      const currentMonthRow = reports.rows[reports.rows.length - 1];
      expect(currentMonthRow.orders).toBe(2);
      expect(currentMonthRow.revenue).toBe(150.0);
      expect(currentMonthRow.averageOrderValue).toBe(75.0);
      expect(reports.totals.totalOrders).toBe(2);
      expect(reports.totals.totalRevenue).toBe(150.0);
      expect(reports.totals.overallAverageOrderValue).toBe(75.0);
    });
  });

  describe('exportReportsCsv', () => {
    it('should format reports table and summary into RFC 4180 CSV', async () => {
      const now = new Date();
      prisma.transaction.findMany.mockResolvedValueOnce([
        {
          amount: new Prisma.Decimal('150.00'),
          status: TransactionStatus.COMPLETED,
          createdAt: now,
        },
      ]);

      const csv = await service.exportReportsCsv();

      expect(csv).toContain(
        'Month,Orders,Revenue ($),Avg / Order ($),Growth MoM (%)',
      );
      expect(csv).toContain('Total / Summary');
      expect(csv).toContain('150');
    });
  });
});
