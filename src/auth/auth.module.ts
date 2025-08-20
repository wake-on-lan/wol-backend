import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../database/entities/user.entity';
import { JwtStrategy } from './jwt.strategy';
import { KeysModule } from 'src/keys/keys.module';
import { UserKeyService } from 'src/keys/user-key.service';
import { UserPublicKey } from 'src/database/entities/user-public-key.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserPublicKey]),
    PassportModule,
    KeysModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, UserKeyService],
  exports: [AuthService],
})
export class AuthModule {}
