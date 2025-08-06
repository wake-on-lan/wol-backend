import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { User } from '../entities/user.entity';
import { KeysModule } from '../keys/keys.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), KeysModule],
  providers: [SeedService],
  exports: [SeedService],
})
export class DatabaseModule {}
