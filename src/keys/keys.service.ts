import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { ServerKey } from '../entities/server-key.entity';
import { UserPublicKey } from '../entities/user-public-key.entity';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class KeysService {
  constructor(
    @InjectRepository(ServerKey)
    private serverKeyRepository: Repository<ServerKey>,
    @InjectRepository(UserPublicKey)
    private userPublicKeyRepository: Repository<UserPublicKey>,
    private cryptoService: CryptoService,
  ) {}

  async getCurrentServerKey(): Promise<ServerKey> {
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
    }

    return activeKey;
  }

  async generateNewServerKey(): Promise<ServerKey> {
    const keyPair = this.cryptoService.generateKeyPair();
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

  async registerUserPublicKey(
    userId: number,
    publicKeyPem: string,
  ): Promise<UserPublicKey> {
    if (!this.cryptoService.validatePublicKey(publicKeyPem)) {
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

  async getExpiringKeys(): Promise<{
    userKeys: UserPublicKey[];
    serverKeys: ServerKey[];
  }> {
    const warningTime = new Date();
    warningTime.setHours(warningTime.getHours() + 2);

    const userKeys = await this.userPublicKeyRepository.find({
      where: {
        isActive: true,
        expiresAt: LessThan(warningTime),
      },
      relations: ['user'],
    });

    const serverKeys = await this.serverKeyRepository.find({
      where: {
        isActive: true,
        expiresAt: LessThan(warningTime),
      },
    });

    return { userKeys, serverKeys };
  }

  async deactivateExpiredKeys(): Promise<void> {
    const now = new Date();

    await this.userPublicKeyRepository.update(
      {
        expiresAt: LessThan(now),
      },
      { isActive: false },
    );

    await this.serverKeyRepository.update(
      {
        isActive: true,
        expiresAt: LessThan(now),
      },
      { isActive: false },
    );
  }
}
