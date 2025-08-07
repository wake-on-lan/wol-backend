import { Module, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_PIPE, APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { KeysModule } from './keys/keys.module';
import { CommandsModule } from './commands/commands.module';
import { CryptoModule } from './crypto/crypto.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { DatabaseModule } from './database/database.module';
import { EncryptionModule } from './encryption/encryption.module';
import { AppConfigModule } from './config/config.module';
import {createDatabaseConfig} from './config/database.config';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { ServerKeySubscriber } from './entities/server-key.subscriber';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({...createDatabaseConfig(configService)}),
    }),
    EncryptionModule,
    AuthModule,
    KeysModule,
    CommandsModule,
    CryptoModule,
    SchedulerModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
})
export class AppModule {}
