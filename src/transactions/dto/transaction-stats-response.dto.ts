import { ApiProperty } from '@nestjs/swagger';

export class TransactionStatsDto {
  @ApiProperty({
    example: 2840,
    description: 'Total count of recorded transactions',
  })
  total!: number;

  @ApiProperty({
    example: 1148200.0,
    description: 'Total gross volume of completed transactions',
  })
  revenue!: number;

  @ApiProperty({
    example: 404.3,
    description: 'Average ticket size for completed transactions',
  })
  avg!: number;

  @ApiProperty({
    example: 18,
    description: 'Number of transactions in PENDING state',
  })
  pendingCount!: number;

  @ApiProperty({
    example: 96.8,
    description: 'Percentage of successful completed transactions',
  })
  successRate!: number;

  @ApiProperty({
    example: 2748,
    description: 'Count of COMPLETED transactions',
  })
  completedCount!: number;

  @ApiProperty({ example: 54, description: 'Count of FAILED transactions' })
  failedCount!: number;

  @ApiProperty({ example: 20, description: 'Count of REFUNDED transactions' })
  refundedCount!: number;
}
