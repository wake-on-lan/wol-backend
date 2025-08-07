import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { KeysModule } from '../keys/keys.module';
import { ServerContextModule } from 'src/servercontext/server-context.module';

@Module({
  imports: [KeysModule, ServerContextModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
