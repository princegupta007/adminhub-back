import { ApiProperty } from '@nestjs/swagger';

export class MonthlyReportRowDto {
  @ApiProperty({ example: 'Jan 2026', description: 'Month and year label' })
  month!: string;

  @ApiProperty({
    example: 45,
    description: 'Number of orders placed in this month',
  })
  orders!: number;

  @ApiProperty({
    example: 12500.5,
    description: 'Total completed revenue in this month',
  })
  revenue!: number;

  @ApiProperty({
    example: 277.79,
    description: 'Average order value in this month',
  })
  averageOrderValue!: number;

  @ApiProperty({
    example: 12.5,
    description: 'Month-over-month revenue percentage growth',
    nullable: true,
  })
  growth!: number | null;
}

export class ReportsSummaryTotalsDto {
  @ApiProperty({
    example: 540,
    description: 'Total orders across the reported periods',
  })
  totalOrders!: number;

  @ApiProperty({
    example: 150000.0,
    description: 'Total revenue across the reported periods',
  })
  totalRevenue!: number;

  @ApiProperty({
    example: 277.78,
    description: 'Average order value across all reported periods',
  })
  overallAverageOrderValue!: number;

  @ApiProperty({
    example: 12500.0,
    description: 'Average monthly revenue',
  })
  averageMonthlyRevenue!: number;
}

export class DashboardReportsResponseDto {
  @ApiProperty({
    type: [MonthlyReportRowDto],
    description: 'Monthly historical breakdown',
  })
  rows!: MonthlyReportRowDto[];

  @ApiProperty({
    type: ReportsSummaryTotalsDto,
    description: 'Summary aggregates row',
  })
  totals!: ReportsSummaryTotalsDto;
}
