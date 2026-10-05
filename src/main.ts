import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 1. Security Headers via Helmet
  app.use(helmet());

  // 2. CORS configuration with env-configured origin whitelist
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
      // Allow non-browser requests (Postman, curl, server-to-server)
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

  // 3. Global strict validation pipe
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

  // 4. Global API route prefix /api/v1 (health routes excluded for cloud probes)
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'api/v1/health'],
  });

  // 5. Swagger / OpenAPI Documentation mounted at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Miles Admin Hub API')
    .setDescription(
      'Production-ready REST API for Miles Admin Dashboard. Covers authentication, users, transactions, bookings, and dashboard analytics.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('System', 'System health probes and runtime diagnostics')
    .addTag(
      'Authentication',
      'Admin login, credential verification, and profile management',
    )
    .addTag(
      'Users',
      'User management, pagination, search, statistics, and profile lifecycle',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('port', 4000);
  await app.listen(port);

  Logger.log(`Miles Admin Hub API running on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger documentation mounted at /api/docs`, 'Bootstrap');
}
await bootstrap();
