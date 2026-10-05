import { ApiProperty } from '@nestjs/swagger';
import { BookingSummaryDto } from '../../bookings/dto/booking-response.dto.js';
import { TransactionSummaryDto } from '../../transactions/dto/transaction-response.dto.js';
import { AlertItemDto } from './dashboard-alerts.dto.js';
import { DashboardChartsResponseDto } from './dashboard-charts.dto.js';
import { SystemHealthResponseDto } from './dashboard-health.dto.js';
import { DashboardStatsResponseDto } from './dashboard-stats.dto.js';

export class DashboardOverviewResponseDto {
  @ApiProperty({
    type: DashboardStatsResponseDto,
    description: 'KPI cards and aggregate totals',
  })
  stats: DashboardStatsResponseDto;

  @ApiProperty({
    type: DashboardChartsResponseDto,
    description: 'Chart series and breakdowns',
  })
  charts: DashboardChartsResponseDto;

  @ApiProperty({
    type: [AlertItemDto],
    description: 'Active unresolved operational alerts',
  })
  alerts: AlertItemDto[];

  @ApiProperty({
    type: SystemHealthResponseDto,
    description: 'System infrastructure and health metrics',
  })
  health: SystemHealthResponseDto;

  @ApiProperty({
    type: [TransactionSummaryDto],
    description: 'Recent transactions for quick dashboard overview',
  })
  recentTransactions: TransactionSummaryDto[];

  @ApiProperty({
    type: [BookingSummaryDto],
    description: 'Next upcoming customer booking appointments',
  })
  upcomingBookings: BookingSummaryDto[];
}
