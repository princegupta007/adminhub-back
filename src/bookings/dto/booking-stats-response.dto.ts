import { ApiProperty } from '@nestjs/swagger';

export class BookingStatsDto {
  @ApiProperty({ example: 480, description: 'Total service bookings recorded' })
  total!: number;

  @ApiProperty({
    example: 185,
    description: 'Active bookings (CONFIRMED or PENDING)',
  })
  active!: number;

  @ApiProperty({
    example: 140,
    description: 'Upcoming bookings with future scheduled dates',
  })
  upcoming!: number;

  @ApiProperty({
    example: 230,
    description: 'Total completed service bookings',
  })
  completed!: number;

  @ApiProperty({ example: 65, description: 'Total cancelled bookings' })
  cancelled!: number;

  @ApiProperty({
    example: 71520.0,
    description: 'Gross revenue value of non-cancelled bookings',
  })
  totalRevenue!: number;

  @ApiProperty({
    example: 8.4,
    description: 'Month-over-month percentage change in total bookings',
  })
  totalChangePct!: number;

  @ApiProperty({
    example: 3.1,
    description: 'Month-over-month percentage change in active bookings',
  })
  activeChangePct!: number;

  @ApiProperty({
    example: 12.1,
    description: 'Month-over-month percentage change in completed bookings',
  })
  completedChangePct!: number;

  @ApiProperty({
    example: 1.4,
    description: 'Month-over-month percentage change in cancelled bookings',
  })
  cancelledChangePct!: number;
}
