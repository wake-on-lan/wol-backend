import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ServerKey } from '../database/entities/server-key.entity';
import { CryptoUtil } from '../crypto/crypto.util';

@Injectable()
export class ServerContextService {
  private readonly logger = new Logger(ServerContextService.name);
  private cachedServerKey: ServerKey | null = null;
  private refreshTimer: NodeJS.Timeout;

  constructor(
    @InjectRepository(ServerKey)
    private serverKeyRepository: Repository<ServerKey>,
  ) {}

  async onModuleInit() {
    await this.refreshServerKey();
    this.startPeriodicRefresh();
  }

  async getCurrentServerKey(): Promise<ServerKey> {
    if (!this.cachedServerKey || this.isKeyExpired(this.cachedServerKey)) {
      await this.refreshServerKey();
    }

    if (!this.cachedServerKey) {
      throw new Error('Unable to retrieve or generate server key');
    }

    return this.cachedServerKey;
  }

  private async refreshServerKey(): Promise<void> {
    try {
      let activeKey = await this.serverKeyRepository.findOne({
        where: {
          isActive: true,
          expiresAt: MoreThan(new Date()),
        },
        order: {
          createdAt: 'DESC',
        },
      });

      if (!activeKey) {
        activeKey = await this.generateNewServerKey();
        this.logger.log('Generated new server key');
      } else {
        this.logger.debug('Loaded existing active server key');
      }

      this.cachedServerKey = activeKey;
    } catch (error) {
      this.logger.error('Failed to refresh server key', error);
      throw error;
    }
  }

  private async generateNewServerKey(): Promise<ServerKey> {
    const keyPair = CryptoUtil.generateKeyPair();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const newKey = this.serverKeyRepository.create({
      publicKeyPem: keyPair.publicKey,
      privateKeyPem: keyPair.privateKey,
      expiresAt,
      isActive: true,
    });

    return this.serverKeyRepository.save(newKey);
  }

  private isKeyExpired(key: ServerKey): boolean {
    return new Date() >= key.expiresAt;
  }

  private startPeriodicRefresh(): void {
    // Refresh every hour
    this.refreshTimer = setInterval(async () => {
      try {
        await this.refreshServerKey();
      } catch (error) {
        this.logger.error('Periodic server key refresh failed', error);
      }
    }, 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }
}