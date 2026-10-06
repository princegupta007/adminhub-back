import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  calculateSkip,
  createPaginationMeta,
} from '../common/utils/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ActivitiesQueryDto } from './dto/activities-query.dto.js';
import type {
  ActivityDto,
  ActivityListResponseDto,
} from './dto/activity-response.dto.js';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ActivitiesQueryDto): Promise<ActivityListResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = calculateSkip(page, limit);

    const where: Prisma.ActivityLogWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action?.trim()) {
      where.action = { contains: query.action.trim(), mode: 'insensitive' };
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { action: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [total, records] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              userCode: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const data: ActivityDto[] = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      action: r.action,
      description: r.description,
      createdAt: r.createdAt.toISOString(),
      user: r.user
        ? {
            id: r.user.id,
            userCode: r.user.userCode,
            name: `${r.user.firstName} ${r.user.lastName}`.trim(),
            email: r.user.email,
          }
        : undefined,
    }));

    const meta = createPaginationMeta(total, page, limit);

    return {
      data,
      meta,
    };
  }
}
