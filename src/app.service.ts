import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service.js';

export interface HealthStatus {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

export interface ReadinessStatus {
  status: 'ok';
  database: 'connected';
  uptime: number;
  timestamp: string;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * General heartbeat probe for backward compatibility.
   */
  getHealth(): HealthStatus {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime() * 100) / 100,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Process liveness probe verifying event loop responsiveness.
   */
  getLiveness(): HealthStatus {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime() * 100) / 100,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Dependency readiness probe checking PostgreSQL connection.
   * Returns 200 OK when database is accessible; throws 503 Service Unavailable on failure.
   */
  async getReadiness(): Promise<ReadinessStatus> {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
      return {
        status: 'ok',
        database: 'connected',
        uptime: Math.round(process.uptime() * 100) / 100,
        timestamp: new Date().toISOString(),
      };
    } catch {
      this.logger.error('Readiness probe failed: database ping unreachable');
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'disconnected',
        uptime: Math.round(process.uptime() * 100) / 100,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
