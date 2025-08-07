import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { User } from './entities/user.entity';
import { ServerKey } from './entities/server-key.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, ServerKey])],
  providers: [SeedService],
  exports: [SeedService],
})
export class DatabaseModule {}
