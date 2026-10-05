import { ApiProperty } from '@nestjs/swagger';

export class UserStatsDataDto {
  @ApiProperty({ example: 50, description: 'Total non-deleted users' })
  total!: number;

  @ApiProperty({ example: 40, description: 'Active status users' })
  active!: number;

  @ApiProperty({ example: 6, description: 'Inactive status users' })
  inactive!: number;

  @ApiProperty({ example: 4, description: 'Suspended status users' })
  suspended!: number;

  @ApiProperty({
    example: 8,
    description: 'New users registered within current calendar month',
  })
  newThisMonth!: number;

  @ApiProperty({
    example: 12.5,
    description: 'Month-over-month total users change percentage',
  })
  totalChangePct!: number;

  @ApiProperty({
    example: 8.1,
    description: 'Month-over-month active users change percentage',
  })
  activeChangePct!: number;
}

export class UserStatsResponseDto {
  @ApiProperty({ type: UserStatsDataDto })
  data!: UserStatsDataDto;
}
