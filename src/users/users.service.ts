import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User, UserRole, UserStatus } from '@prisma/client';
import {
  createPaginationMeta,
  calculateSkip,
} from '../common/utils/pagination.util.js';
import { toDecimalNumber } from '../common/utils/decimal.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { BulkUserStatusDto } from './dto/bulk-user-status.dto.js';
import { BulkUserRoleDto } from './dto/bulk-user-role.dto.js';
import { BulkUserDeleteDto } from './dto/bulk-user-delete.dto.js';
import { BulkOperationResponseDto } from './dto/bulk-response.dto.js';
import { formatToCsv } from '../common/utils/csv.util.js';
import {
  PaginatedUsersResponseDto,
  UserSummaryDto,
} from './dto/user-response.dto.js';
import { UserDetailDto } from './dto/user-detail-response.dto.js';
import { UserStatsDataDto } from './dto/user-stats-response.dto.js';
import { UsersQueryDto } from './dto/users-query.dto.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Transforms raw Prisma User to standard UserSummaryDto.
   */
  private toUserSummary(user: {
    id: string;
    userCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    avatarUrl: string | null;
    role: UserRole;
    status: UserStatus;
    twoFactorEnabled: boolean;
    joinedAt: Date;
    lastLoginAt: Date | null;
    createdAt: Date;
  }): UserSummaryDto {
    return {
      id: user.id,
      userCode: user.userCode,
      name: `${user.firstName} ${user.lastName}`.trim(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      twoFactorEnabled: user.twoFactorEnabled,
      joinDate: user.joinedAt.toISOString(),
      lastActive: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Maps public sort fields to Prisma OrderByInput array.
   */
  private buildOrderBy(
    sortBy?: string,
    direction?: 'asc' | 'desc',
  ): Prisma.UserOrderByWithRelationInput[] {
    const dir = direction === 'asc' ? 'asc' : 'desc';

    switch (sortBy) {
      case 'name':
        return [{ firstName: dir }, { lastName: dir }, { id: 'asc' }];
      case 'email':
        return [{ email: dir }, { id: 'asc' }];
      case 'joinDate':
      case 'joinedAt':
        return [{ joinedAt: dir }, { id: 'asc' }];
      case 'lastActive':
      case 'lastLoginAt':
        return [{ lastLoginAt: dir }, { id: 'asc' }];
      case 'role':
        return [{ role: dir }, { id: 'asc' }];
      case 'status':
        return [{ status: dir }, { id: 'asc' }];
      case 'userCode':
        return [{ userCode: dir }, { id: 'asc' }];
      case 'createdAt':
      default:
        return [{ createdAt: dir }, { id: 'asc' }];
    }
  }

  /**
   * Resolves active user by UUID or human-readable business code (USR-xxxx).
   */
  private async findActiveUserRecord(codeOrId: string): Promise<User> {
    const isUuid = UUID_REGEX.test(codeOrId);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(isUuid ? { id: codeOrId } : { userCode: codeOrId }),
    };

    const user = await this.prisma.user.findFirst({ where });
    if (!user) {
      throw new NotFoundException(`User '${codeOrId}' not found`);
    }

    return user;
  }

  /**
   * Retrieves paginated list of non-deleted users with filtering, search, and sorting.
   */
  async findAll(query: UsersQueryDto): Promise<PaginatedUsersResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 10));
    const skip = calculateSkip(page, limit);

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    // Role filter
    if (query.role) {
      where.role = query.role;
    }

    // Status filter
    if (query.status) {
      where.status = query.status;
    }

    // Search query across name, email, and userCode (q takes precedence over search)
    const searchTerm = (query.q || query.search || '').trim();
    if (searchTerm) {
      where.OR = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { userCode: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.order || query.sortDirection || 'desc';
    const orderBy = this.buildOrderBy(sortField, sortOrder);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          userCode: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          role: true,
          status: true,
          twoFactorEnabled: true,
          joinedAt: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = users.map((u) => this.toUserSummary(u));
    const meta = createPaginationMeta(total, page, limit);

    return { data, meta };
  }

  /**
   * Aggregates live user metrics for KPI cards and directory header.
   */
  async getStats(): Promise<UserStatsDataDto> {
    const now = new Date();
    const startOfCurrentMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const startOfPreviousMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );

    const [total, active, inactive, suspended, newThisMonth, newLastMonth] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.user.count({
          where: { deletedAt: null, status: UserStatus.ACTIVE },
        }),
        this.prisma.user.count({
          where: { deletedAt: null, status: UserStatus.INACTIVE },
        }),
        this.prisma.user.count({
          where: { deletedAt: null, status: UserStatus.SUSPENDED },
        }),
        this.prisma.user.count({
          where: {
            deletedAt: null,
            joinedAt: { gte: startOfCurrentMonth },
          },
        }),
        this.prisma.user.count({
          where: {
            deletedAt: null,
            joinedAt: {
              gte: startOfPreviousMonth,
              lt: startOfCurrentMonth,
            },
          },
        }),
      ]);

    const totalChangePct =
      newLastMonth === 0
        ? newThisMonth > 0
          ? 100
          : 0
        : Number(
            (((newThisMonth - newLastMonth) / newLastMonth) * 100).toFixed(1),
          );

    const activeChangePct =
      total === 0 ? 0 : Number(((active / total) * 100).toFixed(1));

    return {
      total,
      active,
      inactive,
      suspended,
      newThisMonth,
      totalChangePct,
      activeChangePct,
    };
  }

  /**
   * Retrieves single user aggregate detail with bounded child collections (latest 5 items each).
   */
  async findOne(codeOrId: string): Promise<UserDetailDto> {
    const isUuid = UUID_REGEX.test(codeOrId);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(isUuid ? { id: codeOrId } : { userCode: codeOrId }),
    };

    const user = await this.prisma.user.findFirst({
      where,
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        bookings: {
          orderBy: { scheduledAt: 'desc' },
          take: 5,
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User '${codeOrId}' not found`);
    }

    return {
      id: user.id,
      userCode: user.userCode,
      name: `${user.firstName} ${user.lastName}`.trim(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth
        ? user.dateOfBirth.toISOString().split('T')[0]
        : null,
      addressLine: user.addressLine,
      city: user.city,
      state: user.state,
      country: user.country,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      twoFactorEnabled: user.twoFactorEnabled,
      joinedAt: user.joinedAt.toISOString(),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      recentTransactions: user.transactions.map((txn) => ({
        id: txn.id,
        txnCode: txn.txnCode,
        date: txn.createdAt.toISOString(),
        amount: toDecimalNumber(txn.amount),
        type: txn.type,
        status: txn.status,
        paymentMethod: txn.paymentMethod,
      })),
      recentBookings: user.bookings.map((bkg) => ({
        id: bkg.id,
        bookingCode: bkg.bookingCode,
        service: bkg.serviceName,
        scheduledAt: bkg.scheduledAt.toISOString(),
        amount: toDecimalNumber(bkg.amount),
        status: bkg.status,
      })),
      recentActivity: user.activities.map((act) => ({
        id: act.id,
        title: act.action.replace(/_/g, ' '),
        desc: act.description,
        time: act.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Creates a new user with concurrency-safe atomic sequence code and activity log.
   */
  async create(
    dto: CreateUserDto,
    _actingAdminId?: string,
  ): Promise<UserSummaryDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check for existing active or soft-deleted user with this email
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException(
        `A user with email '${normalizedEmail}' already exists`,
      );
    }

    // Allocate next code from atomic database sequence
    const nextSeq = await this.prisma.getNextSequenceValue('user_code_seq');
    const userCode = `USR-${String(nextSeq).padStart(4, '0')}`;

    const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;

    const createdUser = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          userCode,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: normalizedEmail,
          phone: dto.phone.trim(),
          dateOfBirth,
          addressLine: dto.addressLine?.trim() || null,
          city: dto.city?.trim() || null,
          state: dto.state?.trim() || null,
          country: dto.country?.trim() || null,
          avatarUrl: dto.avatarUrl?.trim() || null,
          role: dto.role || UserRole.VIEWER,
          status: dto.status || UserStatus.ACTIVE,
          twoFactorEnabled: dto.twoFactorEnabled ?? false,
          joinedAt: new Date(),
        },
      });

      await tx.activityLog.create({
        data: {
          userId: newUser.id,
          action: 'USER_CREATED',
          description: `User account created: ${newUser.firstName} ${newUser.lastName} (${newUser.userCode})`,
        },
      });

      return newUser;
    });

    this.logger.log(
      `User created successfully: ${createdUser.userCode} (${createdUser.email})`,
    );

    return this.toUserSummary(createdUser);
  }

  /**
   * Partially updates user attributes with uniqueness and soft-delete checks.
   */
  async update(
    codeOrId: string,
    dto: UpdateUserDto,
    _actingAdminId?: string,
  ): Promise<UserSummaryDto> {
    const user = await this.findActiveUserRecord(codeOrId);

    // If email is changing, verify no collision
    let normalizedEmail = user.email;
    if (dto.email && dto.email.trim().toLowerCase() !== user.email) {
      normalizedEmail = dto.email.trim().toLowerCase();
      const conflict = await this.prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          id: { not: user.id },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `A user with email '${normalizedEmail}' already exists`,
        );
      }
    }

    const dateOfBirth =
      dto.dateOfBirth !== undefined
        ? dto.dateOfBirth
          ? new Date(dto.dateOfBirth)
          : null
        : undefined;

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          firstName:
            dto.firstName !== undefined ? dto.firstName.trim() : undefined,
          lastName:
            dto.lastName !== undefined ? dto.lastName.trim() : undefined,
          email: dto.email !== undefined ? normalizedEmail : undefined,
          phone: dto.phone !== undefined ? dto.phone.trim() : undefined,
          dateOfBirth,
          addressLine:
            dto.addressLine !== undefined
              ? dto.addressLine?.trim() || null
              : undefined,
          city: dto.city !== undefined ? dto.city?.trim() || null : undefined,
          state:
            dto.state !== undefined ? dto.state?.trim() || null : undefined,
          country:
            dto.country !== undefined ? dto.country?.trim() || null : undefined,
          avatarUrl:
            dto.avatarUrl !== undefined
              ? dto.avatarUrl?.trim() || null
              : undefined,
          role: dto.role !== undefined ? dto.role : undefined,
          status: dto.status !== undefined ? dto.status : undefined,
          twoFactorEnabled:
            dto.twoFactorEnabled !== undefined
              ? dto.twoFactorEnabled
              : undefined,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: 'USER_UPDATED',
          description: `User profile updated: ${updated.firstName} ${updated.lastName} (${updated.userCode})`,
        },
      });

      return updated;
    });

    this.logger.log(`User updated: ${updatedUser.userCode}`);

    return this.toUserSummary(updatedUser);
  }

  /**
   * Soft deletes a user (sets deletedAt = now(), excludes from active lists).
   */
  async remove(
    codeOrId: string,
    _actingAdminId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.findActiveUserRecord(codeOrId);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          deletedAt: new Date(),
          status: UserStatus.INACTIVE,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: 'USER_DEACTIVATED',
          description: `User account deactivated and soft deleted: ${user.userCode}`,
        },
      });
    });

    this.logger.log(`User soft deleted: ${user.userCode}`);

    return {
      success: true,
      message: `User ${user.userCode} soft deleted successfully`,
    };
  }

  /**
   * Bulk updates user status for an array of userCodes or UUIDs.
   */
  async bulkStatus(
    dto: BulkUserStatusDto,
    _adminId?: string,
  ): Promise<BulkOperationResponseDto> {
    const rawCodes = dto.userCodes.map((c) => c.trim()).filter(Boolean);
    const isUuids = rawCodes.filter((c) => UUID_REGEX.test(c));

    const matchingUsers = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { userCode: { in: rawCodes } },
          ...(isUuids.length > 0 ? [{ id: { in: isUuids } }] : []),
        ],
      },
      select: { id: true, userCode: true, firstName: true, lastName: true },
    });

    if (matchingUsers.length === 0) {
      return {
        success: true,
        affectedCount: 0,
        affectedCodes: [],
        message: 'No matching active users found to update',
      };
    }

    const ids = matchingUsers.map((u) => u.id);
    const codes = matchingUsers.map((u) => u.userCode);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: { in: ids } },
        data: { status: dto.status },
      });

      await tx.activityLog.createMany({
        data: matchingUsers.map((u) => ({
          userId: u.id,
          action: 'USER_STATUS_BULK_UPDATE',
          description: `User status bulk updated to ${dto.status} (${u.userCode})`,
        })),
      });
    });

    this.logger.log(
      `Bulk status updated for ${codes.length} users: ${codes.join(', ')}`,
    );

    return {
      success: true,
      affectedCount: codes.length,
      affectedCodes: codes,
      message: `Successfully updated status to ${dto.status} for ${codes.length} user(s)`,
    };
  }

  /**
   * Bulk updates user role for an array of userCodes or UUIDs.
   */
  async bulkRole(
    dto: BulkUserRoleDto,
    _adminId?: string,
  ): Promise<BulkOperationResponseDto> {
    const rawCodes = dto.userCodes.map((c) => c.trim()).filter(Boolean);
    const isUuids = rawCodes.filter((c) => UUID_REGEX.test(c));

    const matchingUsers = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { userCode: { in: rawCodes } },
          ...(isUuids.length > 0 ? [{ id: { in: isUuids } }] : []),
        ],
      },
      select: { id: true, userCode: true, firstName: true, lastName: true },
    });

    if (matchingUsers.length === 0) {
      return {
        success: true,
        affectedCount: 0,
        affectedCodes: [],
        message: 'No matching active users found to update',
      };
    }

    const ids = matchingUsers.map((u) => u.id);
    const codes = matchingUsers.map((u) => u.userCode);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: { in: ids } },
        data: { role: dto.role },
      });

      await tx.activityLog.createMany({
        data: matchingUsers.map((u) => ({
          userId: u.id,
          action: 'USER_ROLE_BULK_UPDATE',
          description: `User role bulk updated to ${dto.role} (${u.userCode})`,
        })),
      });
    });

    this.logger.log(
      `Bulk role updated for ${codes.length} users: ${codes.join(', ')}`,
    );

    return {
      success: true,
      affectedCount: codes.length,
      affectedCodes: codes,
      message: `Successfully updated role to ${dto.role} for ${codes.length} user(s)`,
    };
  }

  /**
   * Bulk soft-deletes users.
   */
  async bulkDelete(
    dto: BulkUserDeleteDto,
    _adminId?: string,
  ): Promise<BulkOperationResponseDto> {
    const rawCodes = dto.userCodes.map((c) => c.trim()).filter(Boolean);
    const isUuids = rawCodes.filter((c) => UUID_REGEX.test(c));

    const matchingUsers = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { userCode: { in: rawCodes } },
          ...(isUuids.length > 0 ? [{ id: { in: isUuids } }] : []),
        ],
      },
      select: { id: true, userCode: true, firstName: true, lastName: true },
    });

    if (matchingUsers.length === 0) {
      return {
        success: true,
        affectedCount: 0,
        affectedCodes: [],
        message: 'No matching active users found to delete',
      };
    }

    const ids = matchingUsers.map((u) => u.id);
    const codes = matchingUsers.map((u) => u.userCode);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: { in: ids } },
        data: {
          deletedAt: new Date(),
          status: UserStatus.INACTIVE,
        },
      });

      await tx.activityLog.createMany({
        data: matchingUsers.map((u) => ({
          userId: u.id,
          action: 'USER_BULK_DELETED',
          description: `User account bulk soft deleted (${u.userCode})`,
        })),
      });
    });

    this.logger.log(
      `Bulk soft deleted ${codes.length} users: ${codes.join(', ')}`,
    );

    return {
      success: true,
      affectedCount: codes.length,
      affectedCodes: codes,
      message: `Successfully soft deleted ${codes.length} user(s)`,
    };
  }

  /**
   * Generates RFC 4180 CSV export matching filter and search query parameters.
   */
  async exportCsv(query: UsersQueryDto): Promise<string> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (query.role) {
      where.role = query.role;
    }
    if (query.status) {
      where.status = query.status;
    }

    const searchTerm = (query.q || query.search || '').trim();
    if (searchTerm) {
      where.OR = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { userCode: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.order || query.sortDirection || 'desc';
    const orderBy = this.buildOrderBy(sortField, sortOrder);

    const users = await this.prisma.user.findMany({
      where,
      orderBy,
      take: 1000,
    });

    const headers = [
      'User Code',
      'Name',
      'Email',
      'Phone',
      'Role',
      'Status',
      '2FA Enabled',
      'Joined Date',
      'Last Active',
    ];

    const rows = users.map((u) => [
      u.userCode,
      `${u.firstName} ${u.lastName}`.trim(),
      u.email,
      u.phone || '',
      u.role,
      u.status,
      u.twoFactorEnabled ? 'Yes' : 'No',
      u.joinedAt.toISOString(),
      u.lastLoginAt ? u.lastLoginAt.toISOString() : '',
    ]);

    return formatToCsv(headers, rows);
  }
}
