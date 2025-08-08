import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserKeyService } from './user-key.service';
import { KeysController } from './keys.controller';
import { ServerKey } from '../database/entities/server-key.entity';
import { UserPublicKey } from '../database/entities/user-public-key.entity';
import { ServerKeyService } from './server-key.service';
import { CryptoService } from './crypto.service';

@Module({
  imports: [TypeOrmModule.forFeature([ServerKey, UserPublicKey])],
  controllers: [KeysController],
  providers: [UserKeyService, ServerKeyService, CryptoService],
  exports: [UserKeyService, ServerKeyService, CryptoService],
})
export class KeysModule {}
