import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BookingSummaryDto } from '../bookings/dto/booking-response.dto.js';
import { TransactionSummaryDto } from '../transactions/dto/transaction-response.dto.js';
import { DashboardService } from './dashboard.service.js';
import {
  AlertItemDto,
  ResolveAlertResponseDto,
} from './dto/dashboard-alerts.dto.js';
import {
  DashboardChartsQueryDto,
  DashboardChartsResponseDto,
} from './dto/dashboard-charts.dto.js';
import { SystemHealthResponseDto } from './dto/dashboard-health.dto.js';
import { DashboardOverviewResponseDto } from './dto/dashboard-overview.dto.js';
import { DashboardReportsResponseDto } from './dto/dashboard-reports.dto.js';
import { DashboardStatsResponseDto } from './dto/dashboard-stats.dto.js';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Retrieve dashboard KPI metric cards and aggregate totals',
    description:
      'Calculates 4 primary KPI cards (Users, Revenue, Bookings, Pending Transactions) with 30-day percentage changes, trend indicators, and system-wide totals.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard KPI metrics retrieved successfully',
    type: DashboardStatsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async getStats(): Promise<DashboardStatsResponseDto> {
    return this.dashboardService.getStats();
  }

  @Get('charts')
  @ApiOperation({
    summary: 'Retrieve time-series revenue and categorical distribution charts',
    description:
      'Generates continuous zero-filled time-series for the selected range (7d, 1m, 3m, 6m, 1y), order status breakdowns, booking category volumes, and top-selling products.',
  })
  @ApiResponse({
    status: 200,
    description: 'Chart series and breakdowns retrieved successfully',
    type: DashboardChartsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid range parameter',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async getCharts(
    @Query() query: DashboardChartsQueryDto,
  ): Promise<DashboardChartsResponseDto> {
    return this.dashboardService.getCharts(query);
  }

  @Get('alerts')
  @ApiOperation({
    summary: 'Retrieve active system operational alerts',
    description:
      'Returns unresolved alerts ordered by creation time descending with severity tags and relative time formatting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active alerts retrieved successfully',
    type: [AlertItemDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async getAlerts(): Promise<AlertItemDto[]> {
    return this.dashboardService.getAlerts();
  }

  @Patch('alerts/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve an operational alert',
    description: 'Marks an active system alert as resolved by UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique UUID of the alert',
    example: 'a1f7b9e0-8b1e-4f7b-9e0c-1f7b9e0c1f7b',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert marked as resolved successfully',
    type: ResolveAlertResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid UUID format',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async resolveAlert(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResolveAlertResponseDto> {
    return this.dashboardService.resolveAlert(id);
  }

  @Get('health')
  @ApiOperation({
    summary: 'Retrieve system and infrastructure health metrics',
    description:
      'Reports availability percentage, database latency ping, and active session metrics.',
  })
  @ApiResponse({
    status: 200,
    description: 'System health metrics retrieved successfully',
    type: SystemHealthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async getHealth(): Promise<SystemHealthResponseDto> {
    return this.dashboardService.getHealth();
  }

  @Get('recent-transactions')
  @ApiOperation({
    summary: 'Retrieve latest transactions for the dashboard table',
    description:
      'Returns the most recently recorded transactions with customer profile information.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 6,
    description: 'Number of transactions to return (max: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent transactions retrieved successfully',
    type: [TransactionSummaryDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async getRecentTransactions(
    @Query('limit') limit?: number,
  ): Promise<TransactionSummaryDto[]> {
    return this.dashboardService.getRecentTransactions(
      limit ? Number(limit) : 6,
    );
  }

  @Get('upcoming-bookings')
  @ApiOperation({
    summary: 'Retrieve next upcoming booking appointments',
    description:
      'Returns scheduled future bookings with customer and service details.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 5,
    description: 'Number of upcoming bookings to return (max: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Upcoming bookings retrieved successfully',
    type: [BookingSummaryDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async getUpcomingBookings(
    @Query('limit') limit?: number,
  ): Promise<BookingSummaryDto[]> {
    return this.dashboardService.getUpcomingBookings(limit ? Number(limit) : 5);
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Retrieve complete consolidated dashboard overview payload',
    description:
      'Aggregates KPI metrics, chart time-series, alerts, system health, and recent activities in a single payload.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview retrieved successfully',
    type: DashboardOverviewResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async getOverview(
    @Query() query: DashboardChartsQueryDto,
  ): Promise<DashboardOverviewResponseDto> {
    return this.dashboardService.getOverview(query);
  }

  @Get('reports')
  @ApiOperation({
    summary: 'Retrieve 12-month historical reporting table data',
    description:
      'Aggregates monthly order volume, completed revenue, average order value, month-over-month growth, and summary totals.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard monthly reports retrieved successfully',
    type: DashboardReportsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid Bearer JWT',
  })
  async getReports(): Promise<DashboardReportsResponseDto> {
    return this.dashboardService.getReports();
  }
}
