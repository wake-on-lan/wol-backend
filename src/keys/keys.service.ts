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

    await this.serverKeyRepository.update(
      { isActive: true },
      { isActive: false },
    );

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

    await this.userPublicKeyRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const userPublicKey = this.userPublicKeyRepository.create({
      userId,
      publicKeyPem,
      expiresAt,
      isActive: true,
    });

    return this.userPublicKeyRepository.save(userPublicKey);
  }

  async getUserActivePublicKey(userId: number): Promise<UserPublicKey | null> {
    return this.userPublicKeyRepository.findOne({
      where: {
        userId,
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getUserPublicKeys(userId: number): Promise<UserPublicKey[]> {
    return this.userPublicKeyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
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
        isActive: true,
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
