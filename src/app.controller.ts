import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get(['health', 'api/v1/health'])
  getHealth(): HealthResponse {
    return this.appService.getHealth();
  }
}
