import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Admin,
  Booking,
  BookingLog,
  BookingStatus,
  PaymentStatus,
  Prisma,
  User,
} from '@prisma/client';
import { createPaginationMeta } from '../common/utils/pagination.util.js';
import { toDecimalNumber } from '../common/utils/decimal.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BookingDetailResponseDto,
  BookingLifecycleLogDto,
} from './dto/booking-detail-response.dto.js';
import {
  BookingSummaryDto,
  PaginatedBookingsResponseDto,
} from './dto/booking-response.dto.js';
import { BookingStatsDto } from './dto/booking-stats-response.dto.js';
import { BookingsQueryDto } from './dto/bookings-query.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { UpdateBookingDto } from './dto/update-booking.dto.js';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto.js';
import { CancelBookingDto } from './dto/cancel-booking.dto.js';
import { formatToCsv } from '../common/utils/csv.util.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_STATUS_TRANSITIONS: Record<
  BookingStatus,
  readonly BookingStatus[]
> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
};

type BookingWithUser = Booking & {
  user: User;
};

type BookingFullDetail = Booking & {
  user: User;
  lifecycleLogs: Array<
    BookingLog & {
      admin: Admin | null;
    }
  >;
};

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates endTime adhering strictly to domain invariant:
   * endTime = scheduledAt + durationHours * 3600 * 1000
   */
  private calculateEndTime(scheduledAt: Date, durationHours: number): Date {
    const durationMs = Math.round(durationHours * 3600 * 1000);
    return new Date(scheduledAt.getTime() + durationMs);
  }

  /**
   * Serializes a database booking row with joined customer into BookingSummaryDto.
   */
  private mapToSummary(booking: BookingWithUser): BookingSummaryDto {
    const customerName =
      `${booking.user.firstName} ${booking.user.lastName}`.trim() ||
      `Customer #${booking.user.userCode}`;

    return {
      id: booking.id,
      bookingCode: booking.bookingCode,
      userId: booking.userId,
      customerName,
      customerEmail: booking.user.email ?? null,
      customerAvatar: booking.user.avatarUrl ?? null,
      serviceName: booking.serviceName,
      category: booking.category,
      scheduledAt: booking.scheduledAt.toISOString(),
      durationHours: toDecimalNumber(booking.durationHours),
      endTime: booking.endTime.toISOString(),
      location: booking.location,
      status: booking.status,
      amount: toDecimalNumber(booking.amount),
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      invoiceCode: booking.invoiceCode,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }

  /**
   * Maps public sort fields to Prisma OrderByInput array with deterministic tie-breaker.
   */
  private buildOrderBy(
    sortBy?: string,
    direction?: string,
  ): Prisma.BookingOrderByWithRelationInput[] {
    const dir = direction?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    switch (sortBy) {
      case 'createdAt':
        return [{ createdAt: dir }, { id: 'asc' }];
      case 'amount':
        return [{ amount: dir }, { id: 'asc' }];
      case 'bookingCode':
      case 'id':
        return [{ bookingCode: dir }, { id: 'asc' }];
      case 'status':
        return [{ status: dir }, { id: 'asc' }];
      case 'customerName':
      case 'customer':
        return [{ user: { firstName: dir } }, { id: 'asc' }];
      case 'duration':
        return [{ durationHours: dir }, { id: 'asc' }];
      case 'scheduledAt':
      default:
        return [{ scheduledAt: dir }, { id: 'asc' }];
    }
  }

  /**
   * Resolves booking record by UUID or business code (BKG-XXXX).
   */
  private async findBookingRecord(idOrCode: string): Promise<BookingWithUser> {
    const isUuid = UUID_REGEX.test(idOrCode);
    const where: Prisma.BookingWhereInput = isUuid
      ? { id: idOrCode }
      : { bookingCode: idOrCode };

    const booking = await this.prisma.booking.findFirst({
      where,
      include: { user: true },
    });

    if (!booking) {
      throw new NotFoundException(
        `Booking appointment '${idOrCode}' was not found in the directory`,
      );
    }

    return booking;
  }

  /**
   * Normalizes status string (case-insensitive enum mapping).
   */
  private normalizeStatus(statusStr?: string): BookingStatus | undefined {
    if (!statusStr) return undefined;
    const lower = statusStr.trim().toLowerCase();
    if (lower === 'all') return undefined;
    const upper = statusStr.trim().toUpperCase();
    if (Object.values(BookingStatus).includes(upper as BookingStatus)) {
      return upper as BookingStatus;
    }
    return undefined;
  }

  /**
   * Verifies that the customer does not have overlapping active appointments.
   */
  private async checkTimeCollision(
    userId: string,
    scheduledAt: Date,
    endTime: Date,
    excludeBookingId?: string,
  ): Promise<void> {
    const collision = await this.prisma.booking.findFirst({
      where: {
        userId,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        scheduledAt: { lt: endTime },
        endTime: { gt: scheduledAt },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
    });

    if (collision) {
      throw new ConflictException(
        `Customer already has an active booking (${collision.bookingCode}) overlapping between ${collision.scheduledAt.toISOString()} and ${collision.endTime.toISOString()}`,
      );
    }
  }

  /**
   * Builds Prisma where filter object from query DTO.
   */
  private buildWhere(query: BookingsQueryDto): Prisma.BookingWhereInput {
    const searchTerm = (query.q ?? query.search)?.trim();
    const normalizedStatus = this.normalizeStatus(query.status);
    const now = new Date();

    const where: Prisma.BookingWhereInput = {};

    // 1. Multi-field search
    if (searchTerm) {
      where.OR = [
        { bookingCode: { contains: searchTerm, mode: 'insensitive' } },
        { serviceName: { contains: searchTerm, mode: 'insensitive' } },
        { category: { contains: searchTerm, mode: 'insensitive' } },
        { invoiceCode: { contains: searchTerm, mode: 'insensitive' } },
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

    // 3. Category & Service filters
    if (query.category && query.category !== 'all') {
      where.category = { contains: query.category.trim(), mode: 'insensitive' };
    }
    if (query.service && query.service !== 'all') {
      where.serviceName = {
        contains: query.service.trim(),
        mode: 'insensitive',
      };
    }

    // 4. Temporal filter (upcoming vs past)
    if (query.when === 'upcoming') {
      where.scheduledAt = { gte: now };
      if (!normalizedStatus) {
        where.status = { not: BookingStatus.CANCELLED };
      }
    } else if (query.when === 'past') {
      where.scheduledAt = { lt: now };
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

    // 6. Date filtering (presets or explicit ISO range)
    if (query.date && query.date !== 'all') {
      const days = parseInt(query.date, 10);
      if (!Number.isNaN(days) && days > 0) {
        const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        where.scheduledAt = { gte: threshold };
      }
    } else if (query.dateFrom || query.dateTo) {
      where.scheduledAt = {};
      if (query.dateFrom) {
        const fromDate = new Date(query.dateFrom);
        if (Number.isNaN(fromDate.getTime())) {
          throw new BadRequestException('Invalid dateFrom parameter');
        }
        where.scheduledAt.gte = fromDate;
      }
      if (query.dateTo) {
        const toDate = new Date(query.dateTo);
        if (Number.isNaN(toDate.getTime())) {
          throw new BadRequestException('Invalid dateTo parameter');
        }
        // Inclusive end of day
        toDate.setHours(23, 59, 59, 999);
        where.scheduledAt.lte = toDate;
      }

      if (
        where.scheduledAt.gte &&
        where.scheduledAt.lte &&
        where.scheduledAt.gte > where.scheduledAt.lte
      ) {
        throw new BadRequestException(
          'dateFrom must be before or equal to dateTo',
        );
      }
    }

    return where;
  }

  /**
   * List paginated bookings with multi-field search, filters, temporal query, and sorting.
   */
  async findAll(
    query: BookingsQueryDto,
  ): Promise<PaginatedBookingsResponseDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;

    const where = this.buildWhere(query);
    const sortDirection = query.sortOrder ?? query.order ?? 'asc';
    const orderBy = this.buildOrderBy(query.sortBy, sortDirection);

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: { user: true },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    const data = bookings.map((b) => this.mapToSummary(b));

    return {
      data,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  /**
   * Retrieves high-level bookings overview statistics for top directory cards.
   */
  async getStats(): Promise<BookingStatsDto> {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );

    const [
      total,
      active,
      upcoming,
      completed,
      cancelled,
      revenueAgg,
      prevTotal,
      prevActive,
      prevCompleted,
      prevCancelled,
    ] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        },
      }),
      this.prisma.booking.count({
        where: {
          scheduledAt: { gte: now },
          status: { not: BookingStatus.CANCELLED },
        },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.COMPLETED },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.CANCELLED },
      }),
      this.prisma.booking.aggregate({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
        _sum: { amount: true },
      }),
      this.prisma.booking.count({
        where: {
          createdAt: {
            gte: startOfPreviousMonth,
            lt: startOfCurrentMonth,
          },
        },
      }),
      this.prisma.booking.count({
        where: {
          createdAt: {
            gte: startOfPreviousMonth,
            lt: startOfCurrentMonth,
          },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        },
      }),
      this.prisma.booking.count({
        where: {
          createdAt: {
            gte: startOfPreviousMonth,
            lt: startOfCurrentMonth,
          },
          status: BookingStatus.COMPLETED,
        },
      }),
      this.prisma.booking.count({
        where: {
          createdAt: {
            gte: startOfPreviousMonth,
            lt: startOfCurrentMonth,
          },
          status: BookingStatus.CANCELLED,
        },
      }),
    ]);

    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100.0 : 0.0;
      const pct = ((current - previous) / previous) * 100;
      return Number(pct.toFixed(1));
    };

    const totalRevenueDecimal = revenueAgg._sum.amount ?? new Prisma.Decimal(0);
    const totalRevenue = toDecimalNumber(totalRevenueDecimal);

    return {
      total,
      active,
      upcoming,
      completed,
      cancelled,
      totalRevenue,
      totalChangePct: calculateGrowth(total, prevTotal),
      activeChangePct: calculateGrowth(active, prevActive),
      completedChangePct: calculateGrowth(completed, prevCompleted),
      cancelledChangePct: calculateGrowth(cancelled, prevCancelled),
    };
  }

  /**
   * Fetches full booking details including customer overview and lifecycle audit logs.
   */
  async findOne(idOrCode: string): Promise<BookingDetailResponseDto> {
    const isUuid = UUID_REGEX.test(idOrCode);
    const where: Prisma.BookingWhereInput = isUuid
      ? { id: idOrCode }
      : { bookingCode: idOrCode };

    const booking = (await this.prisma.booking.findFirst({
      where,
      include: {
        user: true,
        lifecycleLogs: {
          include: { admin: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })) as BookingFullDetail | null;

    if (!booking) {
      throw new NotFoundException(
        `Booking appointment '${idOrCode}' was not found in the directory`,
      );
    }

    // Historical completed bookings count for customer
    const completedBookingsCount = await this.prisma.booking.count({
      where: {
        userId: booking.userId,
        status: BookingStatus.COMPLETED,
      },
    });

    const lifecycleLogs: BookingLifecycleLogDto[] = booking.lifecycleLogs.map(
      (log) => ({
        id: log.id,
        event: log.event,
        description: log.description,
        adminId: log.adminId,
        adminName: log.admin?.name ?? null,
        createdAt: log.createdAt.toISOString(),
      }),
    );

    return {
      id: booking.id,
      bookingCode: booking.bookingCode,
      serviceName: booking.serviceName,
      category: booking.category,
      scheduledAt: booking.scheduledAt.toISOString(),
      durationHours: toDecimalNumber(booking.durationHours),
      endTime: booking.endTime.toISOString(),
      location: booking.location,
      customerNotes: booking.customerNotes,
      status: booking.status,
      amount: toDecimalNumber(booking.amount),
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      invoiceCode: booking.invoiceCode,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
      customer: {
        id: booking.user.id,
        userCode: booking.user.userCode,
        name: `${booking.user.firstName} ${booking.user.lastName}`.trim(),
        firstName: booking.user.firstName,
        lastName: booking.user.lastName,
        email: booking.user.email,
        phone: booking.user.phone,
        avatarUrl: booking.user.avatarUrl,
        completedBookingsCount,
      },
      lifecycleLogs,
    };
  }

  /**
   * Creates a booking with atomic business code allocation, time invariant enforcement, and audit logs.
   */
  async create(
    dto: CreateBookingDto,
    adminId: string,
  ): Promise<BookingSummaryDto> {
    // 1. Verify target customer exists and is not soft-deleted
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(
        `Customer user '${dto.userId}' does not exist or has been deleted`,
      );
    }

    // 2. Validate scheduling date/time and duration invariant
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt timestamp');
    }

    const durationHours = dto.durationHours ?? 1.5;
    if (durationHours <= 0) {
      throw new BadRequestException('durationHours must be greater than 0');
    }

    const endTime = this.calculateEndTime(scheduledAt, durationHours);

    // 3. Collision check: prevent overlapping active bookings for the user
    await this.checkTimeCollision(user.id, scheduledAt, endTime);

    // 4. Atomically generate sequence codes
    const bkgSeq = await this.prisma.getNextSequenceValue('booking_code_seq');
    const bookingCode = `BKG-${bkgSeq.toString().padStart(4, '0')}`;

    const invSeq = await this.prisma.getNextSequenceValue('invoice_code_seq');
    const invoiceCode = `INV-${(10000 + invSeq).toString()}`;

    // 5. Decimal formatting
    const amountDecimal = new Prisma.Decimal(dto.amount.toFixed(2));
    const durationDecimal = new Prisma.Decimal(durationHours.toFixed(2));
    const initialStatus = dto.status ?? BookingStatus.CONFIRMED;
    const initialPaymentStatus = dto.paymentStatus ?? PaymentStatus.PENDING;

    // 6. Execute in atomic transaction
    const createdBooking = await this.prisma.$transaction(async (tx) => {
      const bkg = await tx.booking.create({
        data: {
          bookingCode,
          userId: user.id,
          serviceName: dto.serviceName.trim(),
          category: dto.category.trim(),
          scheduledAt,
          durationHours: durationDecimal,
          endTime,
          location: dto.location?.trim() || 'Virtual - Zoom Link Provided',
          customerNotes: dto.customerNotes?.trim() || null,
          status: initialStatus,
          amount: amountDecimal,
          paymentStatus: initialPaymentStatus,
          paymentMethod: dto.paymentMethod.trim(),
          invoiceCode,
        },
        include: { user: true },
      });

      // Initial lifecycle log
      await tx.bookingLog.create({
        data: {
          bookingId: bkg.id,
          adminId,
          event: 'Booking Created',
          description: `Appointment scheduled for ${user.firstName} ${user.lastName} (${dto.serviceName.trim()})`,
        },
      });

      // Activity log entry for customer audit history
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: 'BOOKING_CREATED',
          description: `Booking ${bookingCode} created for ${dto.serviceName.trim()} scheduled on ${scheduledAt.toISOString()}.`,
        },
      });

      return bkg;
    });

    return this.mapToSummary(createdBooking);
  }

  /**
   * Updates an existing booking with rescheduling, detail editing, lifecycle transitions, and audit logs.
   */
  async update(
    idOrCode: string,
    dto: UpdateBookingDto,
    adminId: string,
  ): Promise<BookingDetailResponseDto> {
    const existing = await this.findBookingRecord(idOrCode);

    // 1. Lifecycle transition validation
    if (dto.status && dto.status !== existing.status) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid booking status transition from ${existing.status} to ${dto.status}. Allowed transitions: ${
            allowed.length > 0 ? allowed.join(', ') : 'None (Terminal state)'
          }`,
        );
      }
    }

    // 2. Rescheduling and time invariant checks
    let scheduledAt = existing.scheduledAt;
    let durationHours = toDecimalNumber(existing.durationHours);
    let endTime = existing.endTime;

    let isRescheduled = false;

    if (dto.scheduledAt || dto.durationHours !== undefined) {
      if (dto.scheduledAt) {
        scheduledAt = new Date(dto.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime())) {
          throw new BadRequestException('Invalid scheduledAt timestamp');
        }
      }
      if (dto.durationHours !== undefined) {
        durationHours = dto.durationHours;
        if (durationHours <= 0) {
          throw new BadRequestException('durationHours must be greater than 0');
        }
      }

      endTime = this.calculateEndTime(scheduledAt, durationHours);
      isRescheduled = true;

      // Verify no collision with other appointments for customer
      await this.checkTimeCollision(
        existing.userId,
        scheduledAt,
        endTime,
        existing.id,
      );
    }

    // 3. Prepare data mutations
    const updateData: Prisma.BookingUpdateInput = {};
    if (isRescheduled) {
      updateData.scheduledAt = scheduledAt;
      updateData.durationHours = new Prisma.Decimal(durationHours.toFixed(2));
      updateData.endTime = endTime;
    }
    if (dto.serviceName !== undefined) {
      updateData.serviceName = dto.serviceName.trim();
    }
    if (dto.category !== undefined) {
      updateData.category = dto.category.trim();
    }
    if (dto.location !== undefined) {
      updateData.location = dto.location.trim();
    }
    if (dto.customerNotes !== undefined) {
      updateData.customerNotes = dto.customerNotes.trim() || null;
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
      // Auto-mark payment as PAID when completed if previously PENDING
      if (
        dto.status === BookingStatus.COMPLETED &&
        existing.paymentStatus === PaymentStatus.PENDING
      ) {
        updateData.paymentStatus = PaymentStatus.PAID;
      }
    }
    if (dto.paymentStatus !== undefined) {
      updateData.paymentStatus = dto.paymentStatus;
    }
    if (dto.paymentMethod !== undefined) {
      updateData.paymentMethod = dto.paymentMethod.trim();
    }
    if (dto.amount !== undefined) {
      updateData.amount = new Prisma.Decimal(dto.amount.toFixed(2));
    }

    // Determine event description for lifecycle logging
    let eventTitle = 'Booking Details Updated';
    let eventDesc = dto.note?.trim() || 'Appointment details updated';

    if (dto.status && dto.status !== existing.status) {
      if (dto.status === BookingStatus.CANCELLED) {
        eventTitle = 'Booking Cancelled';
        eventDesc = dto.note?.trim() || 'Appointment was cancelled';
      } else if (dto.status === BookingStatus.CONFIRMED) {
        eventTitle = 'Status Set to Confirmed';
        eventDesc = dto.note?.trim() || 'Appointment confirmed';
      } else if (dto.status === BookingStatus.COMPLETED) {
        eventTitle = 'Booking Completed';
        eventDesc = dto.note?.trim() || 'Service delivery completed';
      }
    } else if (isRescheduled) {
      eventTitle = 'Booking Rescheduled';
      eventDesc =
        dto.note?.trim() ||
        `Appointment rescheduled to ${scheduledAt.toISOString()}`;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: existing.id },
        data: updateData,
      });

      // Append lifecycle entry
      await tx.bookingLog.create({
        data: {
          bookingId: existing.id,
          adminId,
          event: eventTitle,
          description: eventDesc,
        },
      });

      // Append activity log
      await tx.activityLog.create({
        data: {
          userId: existing.userId,
          action:
            dto.status === BookingStatus.CANCELLED
              ? 'BOOKING_CANCELLED'
              : 'BOOKING_UPDATED',
          description: `Booking ${existing.bookingCode}: ${eventTitle}. ${eventDesc}`,
        },
      });
    });

    return this.findOne(existing.id);
  }

  /**
   * Generates RFC 4180 CSV export matching filter and search query parameters.
   */
  async exportCsv(query: BookingsQueryDto): Promise<string> {
    const where = this.buildWhere(query);
    const sortField = query.sortBy || 'scheduledAt';
    const sortOrder = query.sortOrder ?? query.order ?? 'asc';
    const orderBy = this.buildOrderBy(sortField, sortOrder);

    const bookings = await this.prisma.booking.findMany({
      where,
      orderBy,
      include: { user: true },
      take: 2000,
    });

    const headers = [
      'Booking Code',
      'Invoice Code',
      'Customer Name',
      'Customer Email',
      'Service Name',
      'Category',
      'Scheduled At',
      'Duration (Hours)',
      'End Time',
      'Status',
      'Payment Status',
      'Amount ($)',
      'Location',
    ];

    const rows = bookings.map((b) => [
      b.bookingCode,
      b.invoiceCode,
      b.user ? `${b.user.firstName} ${b.user.lastName}`.trim() : 'Unknown',
      b.user?.email || '',
      b.serviceName,
      b.category,
      b.scheduledAt.toISOString(),
      toDecimalNumber(b.durationHours),
      b.endTime.toISOString(),
      b.status,
      b.paymentStatus,
      toDecimalNumber(b.amount),
      b.location,
    ]);

    return formatToCsv(headers, rows);
  }

  /**
   * Reschedules an existing booking to a new future time window with collision detection.
   */
  async reschedule(
    idOrCode: string,
    dto: RescheduleBookingDto,
    adminId: string,
  ): Promise<BookingDetailResponseDto> {
    const existing = await this.findBookingRecord(idOrCode);

    if (
      existing.status === BookingStatus.CANCELLED ||
      existing.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot reschedule a ${existing.status.toLowerCase()} booking`,
      );
    }

    const newStart = new Date(dto.scheduledAt);
    if (isNaN(newStart.getTime())) {
      throw new BadRequestException('Invalid date format for scheduledAt');
    }
    if (newStart.getTime() <= Date.now()) {
      throw new BadRequestException(
        'Rescheduled appointment time must be in the future',
      );
    }

    const durationMinutes = Math.round(Number(existing.durationHours) * 60);
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000);

    // Collision check: overlapping booking for customer
    const collision = await this.prisma.booking.findFirst({
      where: {
        id: { not: existing.id },
        userId: existing.userId,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        AND: [{ scheduledAt: { lt: newEnd } }, { endTime: { gt: newStart } }],
      },
    });

    if (collision) {
      throw new ConflictException(
        'Rescheduling conflict: Customer already has an active overlapping booking in this time window',
      );
    }

    const eventDesc = dto.note?.trim()
      ? `Rescheduled to ${newStart.toISOString()}: ${dto.note.trim()}`
      : `Appointment rescheduled to ${newStart.toISOString()}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: existing.id },
        data: {
          scheduledAt: newStart,
          endTime: newEnd,
        },
      });

      await tx.bookingLog.create({
        data: {
          bookingId: existing.id,
          adminId,
          event: 'Booking Rescheduled',
          description: eventDesc,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: existing.userId,
          action: 'BOOKING_RESCHEDULED',
          description: `Booking ${existing.bookingCode}: Rescheduled. ${eventDesc}`,
        },
      });
    });

    return this.findOne(existing.id);
  }

  /**
   * Cancels a booking with reason logging and lifecycle timeline generation.
   */
  async cancel(
    idOrCode: string,
    dto: CancelBookingDto,
    adminId: string,
  ): Promise<BookingDetailResponseDto> {
    const existing = await this.findBookingRecord(idOrCode);

    if (existing.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (existing.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    const eventDesc = dto.reason?.trim()
      ? `Cancelled by administrator: ${dto.reason.trim()}`
      : 'Booking cancelled by administrator';

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: existing.id },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });

      await tx.bookingLog.create({
        data: {
          bookingId: existing.id,
          adminId,
          event: 'Booking Cancelled',
          description: eventDesc,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: existing.userId,
          action: 'BOOKING_CANCELLED',
          description: `Booking ${existing.bookingCode}: Cancelled. ${eventDesc}`,
        },
      });
    });

    return this.findOne(existing.id);
  }
}
