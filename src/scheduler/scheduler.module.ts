import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { KeysModule } from '../keys/keys.module';

@Module({
  imports: [KeysModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
