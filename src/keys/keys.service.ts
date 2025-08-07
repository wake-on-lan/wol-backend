import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { ServerKey } from '../database/entities/server-key.entity';
import { UserPublicKey } from '../database/entities/user-public-key.entity';
import { CryptoUtil } from 'src/crypto/crypto.util';

export interface AuthenticatedUser {
  userId: number;
  username: string;
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@Injectable()
export class KeysService {
  constructor(
    @InjectRepository(ServerKey)
    private serverKeyRepository: Repository<ServerKey>,
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

    // Check if user already has a public key
    const existingKey = await this.userPublicKeyRepository.findOne({
      where: { userId },
    });

    if (existingKey) {
      // Update the existing key
      existingKey.publicKeyPem = publicKeyPem;
      existingKey.expiresAt = expiresAt;
      existingKey.isActive = true;
      existingKey.createdAt = new Date();
      return this.userPublicKeyRepository.save(existingKey);
    } else {
      // Create new key
      const userPublicKey = this.userPublicKeyRepository.create({
        userId,
        publicKeyPem,
        expiresAt,
        isActive: true,
      });
      return this.userPublicKeyRepository.save(userPublicKey);
    }
  }

  async getUserActivePublicKey(userId: number): Promise<UserPublicKey | null> {
    const userKey = await this.userPublicKeyRepository.findOne({
      where: { userId },
    });

    // Check if key exists, is active, and not expired
    if (userKey && userKey.isActive && userKey.expiresAt > new Date()) {
      return userKey;
    }

    return null;
  }

  async getUserPublicKey(userId: number): Promise<UserPublicKey | null> {
    return this.userPublicKeyRepository.findOne({
      where: { userId },
    });
  }

  async deactivateExpiredUserKeys(): Promise<void> {
    const now = new Date();

    await this.userPublicKeyRepository.update(
      {
        expiresAt: LessThan(now),
      },
      { isActive: false },
    );
  }
}
