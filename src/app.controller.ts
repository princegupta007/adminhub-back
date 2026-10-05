import { Controller, Get } from '@nestjs/common';
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

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get(['health', 'api/v1/health'])
  @ApiOperation({
    summary: 'Health check probe',
    description:
      'Returns system operational status, server uptime, and timestamp. Public endpoint without authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'System is healthy',
    type: HealthResponseDto,
  })
  getHealth(): HealthResponseDto {
    return this.appService.getHealth();
  }
}
