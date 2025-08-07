import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeysService } from './keys.service';
import { KeysController } from './keys.controller';
import { ServerKey } from '../database/entities/server-key.entity';
import { UserPublicKey } from '../database/entities/user-public-key.entity';
import { ServerContextModule } from 'src/servercontext/server-context.module';
import { CryptoModule } from 'src/crypto/crypto.module';

@Module({
  imports: [TypeOrmModule.forFeature([ServerKey, UserPublicKey]), 
  ServerContextModule, 
  CryptoModule],
  controllers: [KeysController],
  providers: [KeysService],
  exports: [KeysService],
})
export class KeysModule {}
