import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoService } from './crypto.service';
import { UserPublicKey } from '../database/entities/user-public-key.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserPublicKey]),
  ],
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}