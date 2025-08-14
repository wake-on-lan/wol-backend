import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ServerKey } from '../database/entities/server-key.entity';
import { CryptoUtil } from 'src/keys/crypto.util';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ServerKeyConfig } from 'src/config';

@Injectable()
export class ServerKeyService implements OnModuleInit {
  private readonly logger = new Logger(ServerKeyService.name);
  private cachedKey: ServerKey | null = null;
  private serverKeyConfig: ServerKeyConfig;
  constructor(
    @InjectRepository(ServerKey)
    private readonly repository: Repository<ServerKey>,
    private readonly configService: ConfigService,
  ) {
    this.serverKeyConfig =
      this.configService.get<ServerKeyConfig>('server.privateKey') as ServerKeyConfig;
  }

  async onModuleInit(): Promise<void> {
    await this.rotateKeyIfNeeded();
  }

  async getCurrentServerKey(): Promise<ServerKey> {
    if (!this.cachedKey || new Date() >= this.cachedKey.expiresAt) {
      await this.rotateKeyIfNeeded();
    }

    if (!this.cachedKey) {
      throw new Error('No active server key available');
    }

    return this.cachedKey;
  }

  async rotateKeyIfNeeded(): Promise<void> {
    const now = new Date();

    let key = await this.repository.findOne({
      where: { isActive: true, expiresAt: MoreThan(now) },
    });

    const needsRotation =
      !key ||
      now.getTime() + this.parseDuration(this.serverKeyConfig.rotationCutoff) >=
        key.expiresAt.getTime();

    if (needsRotation) {
      if (key) {
        await this.repository.delete(key.id);
        this.logger.log(`Deleted old server key (ID: ${key.id})`);
      }

      key = await this.createKey();
      this.logger.log(`Generated new server key (ID: ${key.id})`);
    }

    this.cachedKey = key;
    this.logger.debug(`Loaded server key (ID: ${key?.id})`);
  }

  private async createKey(): Promise<ServerKey> {
    const { publicKey, privateKey } = CryptoUtil.generateKeyPair();

    const expiresAt = new Date(Date.now() + this.parseDuration(this.serverKeyConfig.expireIn));

    const newKey = this.repository.create({
      publicKeyPem: publicKey,
      privateKeyPem: privateKey,
      expiresAt,
      isActive: true,
    });
    return this.repository.save(newKey);
  }

  private parseDuration(duration: string): number {
    const regex = /^(\d+)([smhd])$/;
    const match = duration.match(regex);

    if (!match) {
      throw new Error(
        `Invalid duration format: ${duration}. Use format like "24h", "30m", "7d"`,
      );
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      s: 1000, // seconds
      m: 60 * 1000, // minutes
      h: 60 * 60 * 1000, // hours
      d: 24 * 60 * 60 * 1000, // days
    };

    return value * multipliers[unit];
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleServerKeyRotation() {
    this.logger.log('Checking ServerKey rotation...');

    try {
      await this.rotateKeyIfNeeded();

      this.logger.log('ServerKey rotation check completed');
    } catch (error) {
      this.logger.error('Error during ServerKey rotation check', error);
    }
  }
}
