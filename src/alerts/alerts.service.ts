import { Injectable, NotFoundException } from '@nestjs/common';
import { Alert, AlertSeverity, Prisma } from '@prisma/client';
import {
  calculateSkip,
  createPaginationMeta,
} from '../common/utils/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AlertResponseDto,
  BatchResolveResponseDto,
  DeleteAlertResponseDto,
  PaginatedAlertsResponseDto,
  ResolveAlertResponseDto,
  ResolveAllResponseDto,
} from './dto/alert-response.dto.js';
import { AlertStatsResponseDto } from './dto/alert-stats-response.dto.js';
import { AlertsQueryDto } from './dto/alerts-query.dto.js';
import { BatchResolveAlertDto } from './dto/batch-resolve-alert.dto.js';
import { CreateAlertDto } from './dto/create-alert.dto.js';
import {
  NotificationFeedItemDto,
  NotificationsFeedResponseDto,
} from './dto/notifications-feed-response.dto.js';
import { UpdateAlertDto } from './dto/update-alert.dto.js';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  mapAlertTone(severity: AlertSeverity): 'danger' | 'warning' | 'info' {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 'danger';
      case AlertSeverity.WARNING:
        return 'warning';
      case AlertSeverity.INFO:
      default:
        return 'info';
    }
  }

  formatRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60)
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  }

  private mapAlertToDto(alert: Alert): AlertResponseDto {
    return {
      id: alert.id,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      tone: this.mapAlertTone(alert.severity),
      isResolved: alert.isResolved,
      time: this.formatRelativeTime(alert.createdAt),
      createdAt: alert.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves paginated alerts with search, severity filter, resolution status filter, and sorting.
   */
  async findAll(query: AlertsQueryDto): Promise<PaginatedAlertsResponseDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 10));
    const skip = calculateSkip(page, limit);

    const searchTerm = query.search || query.q;
    const where: Prisma.AlertWhereInput = {};

    if (searchTerm && searchTerm.trim().length > 0) {
      const term = searchTerm.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.isResolved !== undefined) {
      where.isResolved = query.isResolved;
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const order = query.order ?? 'desc';
    const orderBy: Prisma.AlertOrderByWithRelationInput = {
      [sortBy]: order,
    };

    const [total, alerts] = await Promise.all([
      this.prisma.alert.count({ where }),
      this.prisma.alert.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
    ]);

    return {
      data: alerts.map((a) => this.mapAlertToDto(a)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  /**
   * Retrieves summary counts of alerts grouped by status and severity.
   */
  async getStats(): Promise<AlertStatsResponseDto> {
    const [total, active, resolved, critical, warning, info] =
      await Promise.all([
        this.prisma.alert.count(),
        this.prisma.alert.count({ where: { isResolved: false } }),
        this.prisma.alert.count({ where: { isResolved: true } }),
        this.prisma.alert.count({
          where: { isResolved: false, severity: AlertSeverity.CRITICAL },
        }),
        this.prisma.alert.count({
          where: { isResolved: false, severity: AlertSeverity.WARNING },
        }),
        this.prisma.alert.count({
          where: { isResolved: false, severity: AlertSeverity.INFO },
        }),
      ]);

    return {
      total,
      active,
      resolved,
      critical,
      warning,
      info,
    };
  }

  /**
   * Retrieves an alert by UUID.
   */
  async findById(id: string): Promise<AlertResponseDto> {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID '${id}' not found`);
    }

    return this.mapAlertToDto(alert);
  }

  /**
   * Creates a new administrative system alert.
   */
  async create(dto: CreateAlertDto): Promise<AlertResponseDto> {
    const alert = await this.prisma.alert.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        severity: dto.severity ?? AlertSeverity.INFO,
        isResolved: false,
      },
    });

    return this.mapAlertToDto(alert);
  }

  /**
   * Updates an existing alert's details or status.
   */
  async update(id: string, dto: UpdateAlertDto): Promise<AlertResponseDto> {
    await this.findById(id);

    const updated = await this.prisma.alert.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description.trim(),
        }),
        ...(dto.severity !== undefined && { severity: dto.severity }),
        ...(dto.isResolved !== undefined && { isResolved: dto.isResolved }),
      },
    });

    return this.mapAlertToDto(updated);
  }

  /**
   * Resolves a single alert.
   */
  async resolve(id: string): Promise<ResolveAlertResponseDto> {
    const existing = await this.prisma.alert.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Alert with ID '${id}' not found`);
    }

    const updated = await this.prisma.alert.update({
      where: { id },
      data: { isResolved: true },
    });

    return {
      id: updated.id,
      isResolved: updated.isResolved,
      message: 'Alert marked as resolved',
    };
  }

  /**
   * Resolves multiple alerts in bulk by ID list.
   */
  async batchResolve(
    dto: BatchResolveAlertDto,
  ): Promise<BatchResolveResponseDto> {
    const { ids } = dto;
    const result = await this.prisma.alert.updateMany({
      where: {
        id: { in: ids },
      },
      data: { isResolved: true },
    });

    return {
      resolvedCount: result.count,
      ids,
      message: `Successfully resolved ${result.count} alert${result.count === 1 ? '' : 's'}`,
    };
  }

  /**
   * Resolves all currently active unresolved alerts.
   */
  async resolveAll(): Promise<ResolveAllResponseDto> {
    const result = await this.prisma.alert.updateMany({
      where: { isResolved: false },
      data: { isResolved: true },
    });

    return {
      resolvedCount: result.count,
      message: 'All active alerts marked as resolved',
    };
  }

  /**
   * Deletes an alert record permanently.
   */
  async delete(id: string): Promise<DeleteAlertResponseDto> {
    const existing = await this.prisma.alert.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Alert with ID '${id}' not found`);
    }

    await this.prisma.alert.delete({
      where: { id },
    });

    return {
      id,
      message: 'Alert deleted successfully',
    };
  }

  /**
   * Formats notifications feed for the topbar notifications bell.
   */
  async getNotificationsFeed(limit = 5): Promise<NotificationsFeedResponseDto> {
    const take = Math.min(20, Math.max(1, limit));

    const [unreadCount, alerts] = await Promise.all([
      this.prisma.alert.count({ where: { isResolved: false } }),
      this.prisma.alert.findMany({
        orderBy: { createdAt: 'desc' },
        take,
      }),
    ]);

    const notifications: NotificationFeedItemDto[] = alerts.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.description,
      tone: this.mapAlertTone(a.severity),
      severity: a.severity,
      time: this.formatRelativeTime(a.createdAt),
      unread: !a.isResolved,
      createdAt: a.createdAt.toISOString(),
    }));

    return {
      unreadCount,
      notifications,
    };
  }
}
