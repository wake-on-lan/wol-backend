import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeysService } from './keys.service';
import { KeysController } from './keys.controller';
import { ServerKey } from '../entities/server-key.entity';
import { UserPublicKey } from '../entities/user-public-key.entity';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [TypeOrmModule.forFeature([ServerKey, UserPublicKey]), CryptoModule],
  controllers: [KeysController],
  providers: [KeysService],
  exports: [KeysService],
})
export class KeysModule {}
