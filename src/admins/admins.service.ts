import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, type Admin, type Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  calculateSkip,
  createPaginationMeta,
} from '../common/utils/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminDto,
  AdminListResponseDto,
} from './dto/admin-response.dto.js';
import type { AdminsQueryDto } from './dto/admins-query.dto.js';
import type { CreateAdminDto } from './dto/create-admin.dto.js';
import type { UpdateAdminRoleDto } from './dto/update-admin-role.dto.js';

@Injectable()
export class AdminsService {
  private readonly logger = new Logger(AdminsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private mapAdmin(admin: Admin): AdminDto {
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      avatarUrl: admin.avatarUrl,
      phone: admin.phone,
      timezone: admin.timezone,
      twoFactorEnabled: admin.twoFactorEnabled,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    };
  }

  async findAll(query: AdminsQueryDto): Promise<AdminListResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = calculateSkip(page, limit);

    const where: Prisma.AdminWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.admin.count({ where }),
      this.prisma.admin.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const meta = createPaginationMeta(total, page, limit);
    return {
      data: records.map((a) => this.mapAdmin(a)),
      meta,
    };
  }

  async findOne(id: string): Promise<AdminDto> {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new NotFoundException(`Administrator not found with ID: ${id}`);
    }

    return this.mapAdmin(admin);
  }

  async create(dto: CreateAdminDto): Promise<AdminDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.prisma.admin.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException(
        'An administrator with this email already exists',
      );
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const created = await this.prisma.admin.create({
      data: {
        name: dto.name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: dto.role ?? AdminRole.ADMIN,
        phone: dto.phone?.trim() ?? null,
        timezone: dto.timezone?.trim() ?? 'PST (UTC-08:00)',
        twoFactorEnabled: false,
      },
    });

    this.logger.log(
      `Created new administrator: ${created.email} (${created.role})`,
    );
    return this.mapAdmin(created);
  }

  async updateRole(
    id: string,
    currentAdminId: string,
    dto: UpdateAdminRoleDto,
  ): Promise<AdminDto> {
    const target = await this.prisma.admin.findUnique({
      where: { id },
    });

    if (!target) {
      throw new NotFoundException(`Administrator not found with ID: ${id}`);
    }

    if (id === currentAdminId && target.role !== dto.role) {
      throw new BadRequestException(
        'Cannot change your own administrative role',
      );
    }

    if (
      target.role === AdminRole.SUPER_ADMIN &&
      dto.role !== AdminRole.SUPER_ADMIN
    ) {
      const superAdminCount = await this.prisma.admin.count({
        where: { role: AdminRole.SUPER_ADMIN },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot demote the sole remaining Super Administrator',
        );
      }
    }

    const updated = await this.prisma.admin.update({
      where: { id },
      data: { role: dto.role },
    });

    this.logger.log(
      `Updated role for admin ${updated.email} to ${updated.role} by admin ${currentAdminId}`,
    );
    return this.mapAdmin(updated);
  }

  async delete(
    id: string,
    currentAdminId: string,
  ): Promise<{ message: string }> {
    const target = await this.prisma.admin.findUnique({
      where: { id },
    });

    if (!target) {
      throw new NotFoundException(`Administrator not found with ID: ${id}`);
    }

    if (id === currentAdminId) {
      throw new BadRequestException(
        'Cannot delete your own administrator account',
      );
    }

    if (target.role === AdminRole.SUPER_ADMIN) {
      const superAdminCount = await this.prisma.admin.count({
        where: { role: AdminRole.SUPER_ADMIN },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot delete the sole remaining Super Administrator',
        );
      }
    }

    await this.prisma.admin.delete({
      where: { id },
    });

    this.logger.log(
      `Deleted administrator ${target.email} (id: ${id}) by admin ${currentAdminId}`,
    );
    return { message: 'Administrator account deleted successfully' };
  }
}
