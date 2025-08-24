import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { UserPublicKey } from '../database/entities/user-public-key.entity';
import { CryptoUtil } from 'src/keys/crypto.util';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface AuthenticatedUser {
  userId: number;
  username: string;
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@Injectable()
export class UserKeyService {
  private readonly logger = new Logger(UserKeyService.name);

  constructor(
    @InjectRepository(UserPublicKey)
    private userPublicKeyRepository: Repository<UserPublicKey>,
  ) {}

  validatePublicKey(publicKeyPem: string): boolean {
    try {
      const testData = 'test';
      CryptoUtil.encryptRSA(testData, publicKeyPem);
      return true;
    } catch {
      return false;
    }
  }

  async registerUserPublicKey(
    userId: number,
    publicKeyPem: string,
  ): Promise<UserPublicKey> {
    if (!this.validatePublicKey(publicKeyPem)) {
      throw new BadRequestException('Invalid public key format');
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const existingKey = await this.userPublicKeyRepository.findOne({
      where: { userId },
    });

    if (existingKey) {
      existingKey.publicKeyPem = publicKeyPem;
      existingKey.expiresAt = expiresAt;
      existingKey.isActive = true;
      existingKey.createdAt = new Date();
      return this.userPublicKeyRepository.save(existingKey);
    } else {
      const userPublicKey = this.userPublicKeyRepository.create({
        userId,
        publicKeyPem,
        expiresAt,
        isActive: true,
      });
      return this.userPublicKeyRepository.save(userPublicKey);
    }
  }

  async getUserPublicKey(userId: number): Promise<UserPublicKey | null> {
    return this.userPublicKeyRepository.findOne({
      where: { userId, isActive: true },
    });
  }

  async deactivateExpiredUserKeys(): Promise<void> {
    const updateResult = await this.userPublicKeyRepository.update(
      {
        expiresAt: LessThan(new Date()),
      },
      { isActive: false },
    );
    if (updateResult?.affected) {
      this.logger.log(`Deactivated ${updateResult.affected} expired user keys`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleUserKeyExpiration() {
    this.logger.debug('Running UserKey expiration check...');

    try {
      await this.deactivateExpiredUserKeys();

      this.logger.debug('UserKey expiration check completed');
    } catch (error) {
      this.logger.error('Error during UserKey expiration check', error);
    }
  }
}
