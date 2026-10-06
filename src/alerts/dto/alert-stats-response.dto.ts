import { ApiProperty } from '@nestjs/swagger';

export class AlertStatsResponseDto {
  @ApiProperty({ example: 10, description: 'Total alerts recorded' })
  total: number;

  @ApiProperty({ example: 3, description: 'Active unresolved alerts' })
  active: number;

  @ApiProperty({ example: 7, description: 'Resolved alerts' })
  resolved: number;

  @ApiProperty({
    example: 1,
    description: 'Active CRITICAL severity alerts',
  })
  critical: number;

  @ApiProperty({
    example: 1,
    description: 'Active WARNING severity alerts',
  })
  warning: number;

  @ApiProperty({
    example: 1,
    description: 'Active INFO severity alerts',
  })
  info: number;
}
