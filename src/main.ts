import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(AppConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: configService.server.allowedOrigins,
    credentials: true,
  });

  const port = configService.server.port;
  await app.listen(port);

  Logger.log(`🚀 Encrypted Relay Server running on port ${port}`);
  Logger.log(`📊 Environment: ${configService.server.nodeEnv}`);
  Logger.log(`🗄️  Database seeding runs automatically on startup`);
}
void bootstrap();
