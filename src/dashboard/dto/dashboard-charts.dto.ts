import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class DashboardChartsQueryDto {
  @ApiPropertyOptional({
    description: 'Time window for aggregation',
    enum: ['7d', '1m', '3m', '6m', '1y'],
    default: '6m',
  })
  @IsOptional()
  @IsIn(['7d', '1m', '3m', '6m', '1y'])
  range?: '7d' | '1m' | '3m' | '6m' | '1y' = '6m';
}

export class RevenuePeriodPointDto {
  @ApiProperty({ example: 'Oct 2026', description: 'Label for time bucket' })
  period: string;

  @ApiPropertyOptional({
    example: 'Oct',
    description: 'Short month name (for frontend compatibility)',
  })
  month?: string;

  @ApiProperty({
    example: 80000.0,
    description: 'Sum of completed transaction revenue in this period',
  })
  revenue: number;

  @ApiProperty({
    example: 188,
    description: 'Total count of transactions in this period',
  })
  orders: number;
}

export class StatusSliceDto {
  @ApiProperty({
    example: 'COMPLETED',
    description: 'Raw database status string',
  })
  status: string;

  @ApiProperty({ example: 'Paid', description: 'Human-readable status label' })
  label: string;

  @ApiProperty({ example: 1180, description: 'Number of occurrences' })
  count: number;

  @ApiProperty({ example: 482500.0, description: 'Total monetary value' })
  amount: number;
}

export class CategoryPointDto {
  @ApiProperty({ example: 'Cleaning', description: 'Service category name' })
  category: string;

  @ApiProperty({ example: 160, description: 'Total bookings in this category' })
  bookings: number;

  @ApiProperty({
    example: 24000.0,
    description: 'Total revenue in this category',
  })
  revenue: number;
}

export class TopProductDto {
  @ApiProperty({
    example: 'iPhone 13 Pro',
    description: 'Product or service title',
  })
  title: string;

  @ApiProperty({
    example: 'https://i.pravatar.cc/150?u=prod_1',
    description: 'Thumbnail URL',
  })
  thumbnail: string;

  @ApiProperty({
    example: 142,
    description: 'Units sold or service occurrences',
  })
  unitsSold: number;

  @ApiProperty({ example: 141858.0, description: 'Total revenue generated' })
  revenue: number;
}

export class DashboardChartsResponseDto {
  @ApiProperty({ example: '6m', description: 'Applied time range bucket' })
  range: string;

  @ApiProperty({
    type: [RevenuePeriodPointDto],
    description: 'Revenue and order series',
  })
  revenueByPeriod: RevenuePeriodPointDto[];

  @ApiProperty({
    type: [RevenuePeriodPointDto],
    description: 'Alias for revenueByPeriod matching frontend types',
  })
  revenueByMonth: RevenuePeriodPointDto[];

  @ApiProperty({
    type: [StatusSliceDto],
    description: 'Transaction status distribution for donut chart',
  })
  ordersByStatus: StatusSliceDto[];

  @ApiProperty({
    type: [StatusSliceDto],
    description: 'Booking status breakdown',
  })
  bookingsByStatus: StatusSliceDto[];

  @ApiProperty({
    type: [CategoryPointDto],
    description: 'Top booking categories by volume',
  })
  bookingsByCategory: CategoryPointDto[];

  @ApiProperty({
    type: [TopProductDto],
    description: 'Top performing products by revenue',
  })
  topProducts: TopProductDto[];
}
