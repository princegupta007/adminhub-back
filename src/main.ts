import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 1. Enable graceful shutdown hooks for SIGTERM / SIGINT
  app.enableShutdownHooks();

  // 2. Security Headers via Helmet
  app.use(helmet());

  // 3. CORS configuration with env-configured origin whitelist
  const frontendUrl = configService.get<string>('frontendUrl', '');
  const allowedOrigins = frontendUrl
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow non-browser requests (Postman, curl, health probes, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      if (
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  });

  // 4. Global strict validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  // 5. Global API route prefix /api/v1 (health routes excluded for cloud probes)
  app.setGlobalPrefix('api/v1', {
    exclude: [
      'health',
      'health/live',
      'health/ready',
      'api/v1/health',
      'api/v1/health/live',
      'api/v1/health/ready',
    ],
  });

  // 6. Swagger / OpenAPI Documentation (configurable, enabled by default in non-prod)
  const isSwaggerEnabled = configService.get<boolean>('swagger.enabled', true);
  if (isSwaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Miles Admin Hub API')
      .setDescription(
        'Production-ready REST API for Miles Admin Dashboard. Covers authentication, users, transactions, bookings, alerts, and dashboard analytics.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter your JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('System', 'System health probes and runtime diagnostics')
      .addTag(
        'Authentication',
        'Admin login, credential verification, and profile management',
      )
      .addTag(
        'Users',
        'User management, pagination, search, statistics, and profile lifecycle',
      )
      .addTag(
        'Transactions',
        'Financial transactions ledger, invoice lookups, status transitions, and audit logs',
      )
      .addTag(
        'Bookings',
        'Meeting logistics, service appointments, reschedule/cancel workflows, and audit logs',
      )
      .addTag(
        'Dashboard',
        'KPI cards, continuous time-series charts, status donuts, and consolidated overview',
      )
      .addTag(
        'Alerts',
        'System alerts, notifications feed, batch resolution, and incident lifecycle',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    Logger.log('Swagger documentation mounted at /api/docs', 'Bootstrap');
  } else {
    Logger.log(
      'Swagger documentation disabled in current environment',
      'Bootstrap',
    );
  }

  const port = configService.get<number>('port', 4000);
  const host = configService.get<string>('host', '0.0.0.0');
  await app.listen(port, host);

  Logger.log(
    `Miles Admin Hub API running on http://${host}:${port}`,
    'Bootstrap',
  );
}
await bootstrap();
