import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoService } from './crypto.service';
import { UserPublicKey } from '../database/entities/user-public-key.entity';
import { ServerContextModule } from 'src/servercontext/server-context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserPublicKey]),
    ServerContextModule,
  ],
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}