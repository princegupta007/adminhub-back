import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  Reflector,
} from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { THROTTLE_LOGIN_KEY } from './common/decorators/throttle-login.decorator.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import configuration from './config/configuration.js';
import { validateEnv } from './config/validation.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService, Reflector],
      useFactory: (configService: ConfigService, reflector: Reflector) => {
        const ttlSeconds = configService.get<number>('throttle.ttl', 60);
        const limit = configService.get<number>('throttle.limit', 100);
        const loginLimit = configService.get<number>('throttle.loginLimit', 5);

        return [
          {
            name: 'default',
            ttl: seconds(ttlSeconds),
            limit,
            skipIf: (context) =>
              Boolean(
                reflector.getAllAndOverride<boolean>(THROTTLE_LOGIN_KEY, [
                  context.getHandler(),
                  context.getClass(),
                ]),
              ),
          },
          {
            name: 'login',
            ttl: seconds(ttlSeconds),
            limit: loginLimit,
            skipIf: (context) =>
              !reflector.getAllAndOverride<boolean>(THROTTLE_LOGIN_KEY, [
                context.getHandler(),
                context.getClass(),
              ]),
          },
        ];
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TransactionsModule,
    BookingsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
