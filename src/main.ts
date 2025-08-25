import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowedOrigins = configService.get<string[]>('server.allowedOrigins');
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = configService.get('server.port');
  await app.listen(port);
  Logger.log(`Allowed Origins: ${allowedOrigins}`);
  Logger.log(`🚀 Encrypted Relay Server running on port ${port}`);
  Logger.log(`📊 Environment: ${configService.get('server.nodeEnv')}`);
  Logger.log(`🗄️  Database seeding runs automatically on startup`);
}
void bootstrap();
