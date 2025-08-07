import { Module } from '@nestjs/common';
import { ServerContextService } from './server-context.service';
import { ServerKey } from 'src/database/entities/server-key.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([ServerKey]), ServerContextModule],
  providers: [ServerContextService],
  exports: [ServerContextService],
})
export class ServerContextModule {}
