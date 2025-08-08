import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { User } from './entities/user.entity';
import { ServerKey } from './entities/server-key.entity';
import { EncryptionService } from './encryption/encryption.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, ServerKey])],
  providers: [SeedService, EncryptionService],
  exports: [SeedService, EncryptionService],
})
export class DatabaseModule {}
