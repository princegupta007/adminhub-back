import { ApiProperty } from '@nestjs/swagger';

export class KpiStatDto {
  @ApiProperty({ example: 'users', description: 'Unique metric identifier' })
  id: string;

  @ApiProperty({
    example: 'Total Users',
    description: 'Display label for metric card',
  })
  label: string;

  @ApiProperty({ example: 1420, description: 'Calculated value' })
  value: number;

  @ApiProperty({
    example: 'number',
    enum: ['currency', 'fullCurrency', 'number', 'percent'],
  })
  format: 'currency' | 'fullCurrency' | 'number' | 'percent';

  @ApiProperty({
    example: 12.5,
    nullable: true,
    description: 'Percentage change over previous period',
  })
  changePct: number | null;

  @ApiProperty({
    example: 'up',
    enum: ['up', 'down', 'flat'],
    description: 'Trend indicator direction',
  })
  trend: 'up' | 'down' | 'flat';

  @ApiProperty({
    example: 'vs previous 30 days',
    description: 'Contextual hint string',
  })
  hint: string;
}

export class DashboardTotalsDto {
  @ApiProperty({
    example: 482500.0,
    description: 'Total revenue from completed transactions',
  })
  revenue: number;

  @ApiProperty({
    example: 14200.0,
    description: 'Total pending transaction value',
  })
  pendingRevenue: number;

  @ApiProperty({ example: 1240, description: 'Total number of transactions' })
  orders: number;

  @ApiProperty({
    example: 1180,
    description: 'Count of completed transactions',
  })
  paidOrders: number;

  @ApiProperty({ example: 18, description: 'Count of pending transactions' })
  pendingOrders: number;

  @ApiProperty({ example: 42, description: 'Count of failed transactions' })
  failedOrders: number;

  @ApiProperty({ example: 1420, description: 'Total active registered users' })
  users: number;

  @ApiProperty({ example: 480, description: 'Total bookings recorded' })
  bookings: number;

  @ApiProperty({ example: 210, description: 'Count of confirmed bookings' })
  confirmedBookings: number;

  @ApiProperty({ example: 230, description: 'Count of completed bookings' })
  completedBookings: number;

  @ApiProperty({
    example: 408.9,
    description: 'Average order value (Revenue / Paid Orders)',
  })
  averageOrderValue: number;

  @ApiProperty({
    example: 91.67,
    description: 'Percentage of non-cancelled bookings',
  })
  bookingSuccessRate: number;
}

export class DashboardStatsResponseDto {
  @ApiProperty({ type: [KpiStatDto], description: '4 core KPI metric cards' })
  kpis: KpiStatDto[];

  @ApiProperty({
    type: DashboardTotalsDto,
    description: 'Aggregated totals across all modules',
  })
  totals: DashboardTotalsDto;
}
