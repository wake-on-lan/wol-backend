import { Module, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_PIPE, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { KeysModule } from './keys/keys.module';
import { CommandsModule } from './commands/commands.module';
import { DatabaseModule } from './database/database.module';
import { createDatabaseConfig } from './database/database.config';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { ServerKeySubscriber } from './database/entities/server-key.subscriber';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import config from './config';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...createDatabaseConfig(configService),
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    KeysModule,
    CommandsModule,
    DatabaseModule,
  ],
  providers: [
    ConfigService,
    ServerKeySubscriber,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [],
})
export class AppModule {}
