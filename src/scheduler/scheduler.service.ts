import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KeysService } from '../keys/keys.service';
import { ServerContextService } from '../servercontext/server-context.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private keysService: KeysService,
    private serverContextService: ServerContextService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleUserKeyExpiration() {
    this.logger.log('Running key expiration check...');

    try {
      await this.keysService.deactivateExpiredUserKeys();

      this.logger.log('Key expiration check completed');
    } catch (error) {
      this.logger.error('Error during key expiration check', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleServerKeyRotation() {
    this.logger.log('Starting server key rotation...');

    try {
     await this.serverContextService.getCurrentServerKey();


      this.logger.log('Server key rotation completed');
    } catch (error) {
      this.logger.error('Error during server key rotation', error);
    }
  }
}
