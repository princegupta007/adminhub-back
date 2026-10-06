import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { Public } from './common/decorators/public.decorator.js';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', description: 'System health status' })
  status!: string;

  @ApiProperty({ example: 42.5, description: 'Server uptime in seconds' })
  uptime!: number;

  @ApiProperty({
    example: '2026-10-05T16:40:00.000Z',
    description: 'ISO-8601 timestamp',
  })
  timestamp!: string;
}

export class ReadinessResponseDto {
  @ApiProperty({ example: 'ok', description: 'Readiness status' })
  status!: string;

  @ApiProperty({
    example: 'connected',
    description: 'Database connectivity state',
  })
  database!: string;

  @ApiProperty({ example: 42.5, description: 'Server uptime in seconds' })
  uptime!: number;

  @ApiProperty({
    example: '2026-10-05T16:40:00.000Z',
    description: 'ISO-8601 timestamp',
  })
  timestamp!: string;
}

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get(['health', 'api/v1/health'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'General health check probe',
    description:
      'Returns system operational status, server uptime, and timestamp. Backward-compatible endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'System is healthy',
    type: HealthResponseDto,
  })
  getHealth(): HealthResponseDto {
    return this.appService.getHealth();
  }

  @Public()
  @Get(['health/live', 'api/v1/health/live'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process liveness probe',
    description:
      'Verifies process responsiveness for container managers and orchestrators (e.g. Kubernetes, Docker).',
  })
  @ApiResponse({
    status: 200,
    description: 'Process is alive and responding',
    type: HealthResponseDto,
  })
  getLiveness(): HealthResponseDto {
    return this.appService.getLiveness();
  }

  @Public()
  @Get(['health/ready', 'api/v1/health/ready'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Service readiness probe',
    description:
      'Verifies database connectivity before accepting incoming user traffic. Returns 503 if database is disconnected.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service and database dependencies are ready',
    type: ReadinessResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable - database connection failed',
  })
  async getReadiness(): Promise<ReadinessResponseDto> {
    return this.appService.getReadiness();
  }
}
