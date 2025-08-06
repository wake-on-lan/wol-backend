import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { KeysModule } from '../keys/keys.module';

@Module({
  imports: [ScheduleModule.forRoot(), KeysModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
