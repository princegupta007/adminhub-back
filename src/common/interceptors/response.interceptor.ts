import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BYPASS_RESPONSE_TRANSFORM_KEY } from '../decorators/public.decorator.js';

export interface StandardApiResponse<T> {
  data: T;
  meta?: unknown;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  StandardApiResponse<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardApiResponse<T> | T> {
    const isBypassed = this.reflector.getAllAndOverride<boolean>(
      BYPASS_RESPONSE_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isBypassed) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const path = request?.url || '';

    // Bypass health endpoints and swagger documentation assets
    if (
      path.startsWith('/health') ||
      path.startsWith('/api/v1/health') ||
      path.startsWith('/api/docs')
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((res) => {
        // If undefined or null
        if (res === undefined || res === null) {
          return { data: null } as unknown as StandardApiResponse<T>;
        }

        // Avoid double-wrapping if controller already returned { data: ... } or { data, meta }
        if (typeof res === 'object' && 'data' in res) {
          return res;
        }

        return { data: res } as StandardApiResponse<T>;
      }),
    );
  }
}
