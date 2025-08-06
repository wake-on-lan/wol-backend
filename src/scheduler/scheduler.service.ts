import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KeysService } from '../keys/keys.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private keysService: KeysService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleKeyExpiration() {
    this.logger.log('Running key expiration check...');

    try {
      await this.keysService.deactivateExpiredKeys();
      const expiringKeys = await this.keysService.getExpiringKeys();

      if (expiringKeys.userKeys.length > 0) {
        this.logger.warn(
          `${expiringKeys.userKeys.length} user keys are expiring soon`,
        );
        expiringKeys.userKeys.forEach((key) => {
          this.logger.warn(
            `User ${key.user.username} key expires at ${key.expiresAt.toISOString()}`,
          );
        });
      }

      if (expiringKeys.serverKeys.length > 0) {
        this.logger.warn(
          `${expiringKeys.serverKeys.length} server keys are expiring soon`,
        );
      }

      this.logger.log('Key expiration check completed');
    } catch (error) {
      this.logger.error('Error during key expiration check', error);
    }
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async handleServerKeyRotation() {
    this.logger.log('Checking server key rotation...');

    try {
      const currentKey = await this.keysService.getCurrentServerKey();
      const rotationTime = new Date();
      rotationTime.setHours(rotationTime.getHours() + 4);

      if (currentKey.expiresAt < rotationTime) {
        this.logger.log('Generating new server key due to upcoming expiration');
        const newKey = await this.keysService.generateNewServerKey();
        this.logger.log(
          `New server key generated, expires at ${newKey.expiresAt.toISOString()}`,
        );
      }

      this.logger.log('Server key rotation check completed');
    } catch (error) {
      this.logger.error('Error during server key rotation', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyMaintenance() {
    this.logger.log('Running daily maintenance tasks...');

    try {
      await this.keysService.deactivateExpiredKeys();
      this.logger.log('Expired keys cleaned up');

      this.logger.log('Daily maintenance completed');
    } catch (error) {
      this.logger.error('Error during daily maintenance', error);
    }
  }
}
