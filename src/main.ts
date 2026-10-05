import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global API prefix /api/v1, excluding health route
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'api/v1/health'],
  });

  const port = configService.get<number>('port', 4000);
  await app.listen(port);
  Logger.log(`Miles Admin Hub API running on port ${port}`, 'Bootstrap');
}
await bootstrap();
