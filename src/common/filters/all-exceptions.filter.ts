import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

export interface StandardErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
        message = 'Too Many Requests';
        error = 'Too Many Requests';
      } else if (typeof res === 'string') {
        message = res;
        error = exception.name.replace(/Exception$/, '');
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string | string[]) || exception.message;
        error =
          (resObj.error as string) ||
          exception.name.replace(/Exception$/, '') ||
          'Error';
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          statusCode = HttpStatus.CONFLICT;
          const target = (exception.meta?.target as string[])?.join(', ');
          message = target
            ? `Unique constraint violation on field(s): ${target}`
            : 'A resource with this identifier already exists';
          error = 'Conflict';
          break;
        }
        case 'P2025': {
          statusCode = HttpStatus.NOT_FOUND;
          message = (exception.meta?.cause as string) || 'Resource not found';
          error = 'Not Found';
          break;
        }
        case 'P2003': {
          statusCode = HttpStatus.BAD_REQUEST;
          message = 'Foreign key constraint failed';
          error = 'Bad Request';
          break;
        }
        default: {
          statusCode = HttpStatus.BAD_REQUEST;
          message = 'Database operation failed';
          error = 'Bad Request';
          this.logger.error(
            `Prisma error [${exception.code}]: ${exception.message}`,
          );
          break;
        }
      }
    } else {
      // Unhandled 500 error - NEVER leak details/stack trace to client
      const err = exception as Error;
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'Internal Server Error';
    }

    const payload: StandardErrorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(payload);
  }
}
