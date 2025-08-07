import { Module, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_PIPE, APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { KeysModule } from './keys/keys.module';
import { CommandsModule } from './commands/commands.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { DatabaseModule } from './database/database.module';
import { createDatabaseConfig } from './database/database.config';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { ServerKeySubscriber } from './database/entities/server-key.subscriber';
import config from './config';
import { EncryptionModule } from './database/encryption/encryption.module';
import { CryptoModule } from './crypto/crypto.module';
import { ServerContextModule } from './servercontext/server-context.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...createDatabaseConfig(configService),
      }),
    }),
    ServerContextModule,
    AuthModule,
    KeysModule,
    EncryptionModule,
    CommandsModule,
    SchedulerModule,
    DatabaseModule,
    CryptoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
  ],
  exports: [],
})
export class AppModule {}
