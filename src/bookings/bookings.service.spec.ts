import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingsService } from './bookings.service.js';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: {
    booking: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
    user: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    bookingLog: {
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

  const mockBooking = {
    id: '323e4567-e89b-12d3-a456-426614174000',
    bookingCode: 'BKG-0045',
    userId: mockUser.id,
    serviceName: 'Home Deep Cleaning',
    category: 'Cleaning',
    scheduledAt: new Date('2026-10-12T10:00:00.000Z'),
    durationHours: new Prisma.Decimal('1.50'),
    endTime: new Date('2026-10-12T11:30:00.000Z'),
    location: 'Virtual - Zoom Link Provided',
    customerNotes: 'Please focus on kitchen and floors',
    status: BookingStatus.CONFIRMED,
    amount: new Prisma.Decimal('149.00'),
    paymentStatus: PaymentStatus.PAID,
    paymentMethod: 'Credit Card (Visa ending in 4582)',
    invoiceCode: 'INV-10045',
    createdAt: new Date('2026-10-01T09:00:00.000Z'),
    updatedAt: new Date('2026-10-01T09:00:00.000Z'),
    user: mockUser,
    lifecycleLogs: [
      {
        id: 'log-1',
        event: 'Booking Created',
        description: 'Appointment scheduled',
        createdAt: new Date('2026-10-01T09:00:00.000Z'),
        adminId: 'admin-1',
        admin: { name: 'Admin User' },
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      booking: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        aggregate: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
      bookingLog: {
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
        BookingsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  describe('findAll', () => {
    it('should return paginated bookings with summary mapping and pagination metadata', async () => {
      prisma.booking.findMany.mockResolvedValue([mockBooking]);
      prisma.booking.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].bookingCode).toBe('BKG-0045');
      expect(result.data[0].customerName).toBe('Sarah Jenkins');
      expect(result.data[0].serviceName).toBe('Home Deep Cleaning');
      expect(result.data[0].amount).toBe(149.0);
      expect(result.data[0].durationHours).toBe(1.5);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('should apply multi-field search across code, service, category, and customer fields', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await service.findAll({ search: 'Cleaning' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { bookingCode: { contains: 'Cleaning', mode: 'insensitive' } },
              { serviceName: { contains: 'Cleaning', mode: 'insensitive' } },
              { category: { contains: 'Cleaning', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should filter by temporal when: "upcoming" correctly', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await service.findAll({ when: 'upcoming' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
            status: { not: BookingStatus.CANCELLED },
          }),
        }),
      );
    });

    it('should throw BadRequestException if dateFrom > dateTo', async () => {
      await expect(
        service.findAll({
          dateFrom: '2026-10-20',
          dateTo: '2026-10-10',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStats', () => {
    it('should compute overview directory statistics and growth percentages', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(60) // total
        .mockResolvedValueOnce(25) // active
        .mockResolvedValueOnce(20) // upcoming
        .mockResolvedValueOnce(30) // completed
        .mockResolvedValueOnce(5) // cancelled
        .mockResolvedValueOnce(50) // prevTotal
        .mockResolvedValueOnce(20) // prevActive
        .mockResolvedValueOnce(25) // prevCompleted
        .mockResolvedValueOnce(5); // prevCancelled

      prisma.booking.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('71520.00') },
      });

      const stats = await service.getStats();

      expect(stats.total).toBe(60);
      expect(stats.active).toBe(25);
      expect(stats.upcoming).toBe(20);
      expect(stats.completed).toBe(30);
      expect(stats.cancelled).toBe(5);
      expect(stats.totalRevenue).toBe(71520.0);
      expect(stats.totalChangePct).toBe(20.0); // (60 - 50) / 50 = +20%
    });
  });

  describe('findOne', () => {
    it('should return full booking detail by business code with completed bookings count', async () => {
      prisma.booking.findFirst.mockResolvedValue(mockBooking);
      prisma.booking.count.mockResolvedValue(12);

      const detail = await service.findOne('BKG-0045');

      expect(detail.bookingCode).toBe('BKG-0045');
      expect(detail.customer.name).toBe('Sarah Jenkins');
      expect(detail.customer.completedBookingsCount).toBe(12);
      expect(detail.lifecycleLogs).toHaveLength(1);
      expect(detail.lifecycleLogs[0].event).toBe('Booking Created');
    });

    it('should throw NotFoundException if booking does not exist', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(service.findOne('BKG-9999')).rejects.toThrow(
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
            serviceName: 'Consultation',
            category: 'Advisory',
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
            amount: 100,
            paymentMethod: 'Credit Card',
          },
          'admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if customer has overlapping appointment in the requested slot', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.booking.findFirst.mockResolvedValue(mockBooking); // Collision found

      await expect(
        service.create(
          {
            userId: mockUser.id,
            serviceName: 'Consultation',
            category: 'Advisory',
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
            durationHours: 1.5,
            amount: 100,
            paymentMethod: 'Credit Card',
          },
          'admin-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should enforce duration invariant, generate BKG and INV codes atomically, and create audit logs', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.booking.findFirst.mockResolvedValue(null); // No collision
      prisma.getNextSequenceValue
        .mockResolvedValueOnce(61) // booking_code_seq
        .mockResolvedValueOnce(61); // invoice_code_seq

      const scheduledAt = new Date(Date.now() + 100000000);
      const durationHours = 2.0;
      const expectedEndTime = new Date(scheduledAt.getTime() + 2 * 3600 * 1000);

      prisma.booking.create.mockResolvedValue({
        ...mockBooking,
        bookingCode: 'BKG-0061',
        invoiceCode: 'INV-10061',
        scheduledAt,
        durationHours: new Prisma.Decimal('2.00'),
        endTime: expectedEndTime,
        amount: new Prisma.Decimal('200.00'),
      });

      const result = await service.create(
        {
          userId: mockUser.id,
          serviceName: 'Electrical Inspection',
          category: 'Electrical',
          scheduledAt: scheduledAt.toISOString(),
          durationHours,
          amount: 200.0,
          paymentMethod: 'Credit Card',
        },
        'admin-1',
      );

      expect(prisma.getNextSequenceValue).toHaveBeenCalledWith(
        'booking_code_seq',
      );
      expect(prisma.getNextSequenceValue).toHaveBeenCalledWith(
        'invoice_code_seq',
      );
      expect(prisma.bookingLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: 'admin-1',
            event: 'Booking Created',
          }),
        }),
      );
      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'BOOKING_CREATED',
          }),
        }),
      );
      expect(result.bookingCode).toBe('BKG-0061');
      expect(result.invoiceCode).toBe('INV-10061');
    });
  });

  describe('update', () => {
    it('should allow valid transition CONFIRMED -> COMPLETED and auto-mark paymentStatus to PAID', async () => {
      const confirmedBooking = {
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
      };

      prisma.booking.findFirst.mockResolvedValue(confirmedBooking);
      prisma.booking.count.mockResolvedValue(1);

      await service.update(
        confirmedBooking.id,
        {
          status: BookingStatus.COMPLETED,
          note: 'Service successfully performed by field technician',
        },
        'admin-1',
      );

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: confirmedBooking.id },
          data: expect.objectContaining({
            status: BookingStatus.COMPLETED,
            paymentStatus: PaymentStatus.PAID,
          }),
        }),
      );
      expect(prisma.bookingLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'Booking Completed',
          }),
        }),
      );
    });

    it('should reject invalid lifecycle transition from COMPLETED with BadRequestException', async () => {
      const completedBooking = {
        ...mockBooking,
        status: BookingStatus.COMPLETED,
      };
      prisma.booking.findFirst.mockResolvedValue(completedBooking);

      await expect(
        service.update(
          completedBooking.id,
          { status: BookingStatus.PENDING },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should recalculate endTime and prevent collision when rescheduling', async () => {
      prisma.booking.findFirst
        .mockResolvedValueOnce(mockBooking) // for findBookingRecord
        .mockResolvedValueOnce(mockBooking); // for collision check (collision found!)

      await expect(
        service.update(
          mockBooking.id,
          {
            scheduledAt: new Date(Date.now() + 200000000).toISOString(),
            durationHours: 3.0,
          },
          'admin-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
