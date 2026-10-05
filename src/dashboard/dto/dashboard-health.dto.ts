import { ApiProperty } from '@nestjs/swagger';

export class SystemHealthResponseDto {
  @ApiProperty({
    example: '99.8%',
    description: 'System operational availability percentage',
  })
  uptime: string;

  @ApiProperty({
    example: '142ms',
    description: 'Average HTTP API response latency',
  })
  avgResponseTime: string;

  @ApiProperty({
    example: 3241,
    description: 'Concurrent or active registered user sessions',
  })
  activeSessions: number;

  @ApiProperty({
    example: 'connected',
    description: 'PostgreSQL database connection status',
  })
  database: string;

  @ApiProperty({
    example: '2026-10-05T20:00:00.000Z',
    description: 'Sample timestamp',
  })
  timestamp: string;
}
