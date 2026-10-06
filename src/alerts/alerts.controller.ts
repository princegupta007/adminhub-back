import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { AlertsService } from './alerts.service.js';
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
import { NotificationsFeedResponseDto } from './dto/notifications-feed-response.dto.js';
import { UpdateAlertDto } from './dto/update-alert.dto.js';

@ApiTags('Alerts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve paginated system alerts',
    description:
      'Returns paginated list of alerts with optional search keyword, severity filtering, resolution state, and sort options.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated alerts retrieved successfully',
    type: PaginatedAlertsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async findAll(
    @Query() query: AlertsQueryDto,
  ): Promise<PaginatedAlertsResponseDto> {
    return this.alertsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Retrieve system alerts summary statistics',
    description:
      'Returns counts of total, active, resolved, critical, warning, and info alerts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Alerts summary statistics retrieved successfully',
    type: AlertStatsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async getStats(): Promise<AlertStatsResponseDto> {
    return this.alertsService.getStats();
  }

  @Get('notifications-feed')
  @ApiOperation({
    summary: 'Retrieve notifications feed for the topbar bell',
    description:
      'Returns unread count and latest formatted notifications feed for the topbar notifications menu.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of notifications to return (default 5, max 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications feed retrieved successfully',
    type: NotificationsFeedResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async getNotificationsFeed(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<NotificationsFeedResponseDto> {
    return this.alertsService.getNotificationsFeed(limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new administrative system alert',
    description:
      'Creates a new system alert with title, description, and severity.',
  })
  @ApiResponse({
    status: 201,
    description: 'Alert created successfully',
    type: AlertResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation error on payload fields',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async create(@Body() dto: CreateAlertDto): Promise<AlertResponseDto> {
    return this.alertsService.create(dto);
  }

  @Patch('batch-resolve')
  @HttpCode(HttpStatus.OK)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Batch resolve multiple alerts by UUID array',
    description: 'Marks multiple alerts as resolved in a single atomic update.',
  })
  @ApiResponse({
    status: 200,
    description: 'Alerts batch resolved successfully',
    type: BatchResolveResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation error on IDs array',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async batchResolve(
    @Body() dto: BatchResolveAlertDto,
  ): Promise<BatchResolveResponseDto> {
    return this.alertsService.batchResolve(dto);
  }

  @Patch('resolve-all')
  @HttpCode(HttpStatus.OK)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Resolve all active alerts',
    description: 'Marks all active unresolved alerts as resolved.',
  })
  @ApiResponse({
    status: 200,
    description: 'All active alerts marked as resolved',
    type: ResolveAllResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async resolveAll(): Promise<ResolveAllResponseDto> {
    return this.alertsService.resolveAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Retrieve single alert details by UUID',
    description: 'Returns alert details for the given alert ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Alert UUID',
    example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert details retrieved successfully',
    type: AlertResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid UUID parameter',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AlertResponseDto> {
    return this.alertsService.findById(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update alert details or status',
    description:
      'Partially updates an alert title, description, severity, or resolution status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Alert UUID',
    example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert updated successfully',
    type: AlertResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation error or invalid UUID',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertDto,
  ): Promise<AlertResponseDto> {
    return this.alertsService.update(id, dto);
  }

  @Patch(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Resolve single alert',
    description: 'Marks an individual alert as resolved.',
  })
  @ApiParam({
    name: 'id',
    description: 'Alert UUID',
    example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert marked as resolved successfully',
    type: ResolveAlertResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid UUID',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResolveAlertResponseDto> {
    return this.alertsService.resolve(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete alert permanently',
    description:
      'Permanently deletes an alert from the system. Requires SUPER_ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Alert UUID',
    example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert deleted successfully',
    type: DeleteAlertResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid UUID',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Insufficient permissions (Requires SUPER_ADMIN role)',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeleteAlertResponseDto> {
    return this.alertsService.delete(id);
  }
}
