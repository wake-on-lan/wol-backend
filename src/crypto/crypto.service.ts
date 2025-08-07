import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as crypto from 'crypto';
import { UserPublicKey } from '../database/entities/user-public-key.entity';
import { Message } from 'src/interceptors/interceptor.types';
import { ServerKey } from 'src/database/entities/server-key.entity';
import { ServerContextService } from 'src/servercontext/server-context.service';
import { CryptoUtil } from './crypto.util';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

@Injectable()
export class CryptoService {
  private readonly ALGORITHM = 'aes-256-cbc';

  constructor(
    @InjectRepository(UserPublicKey)
    private userPublicKeyRepository: Repository<UserPublicKey>,
    private readonly serverContextService: ServerContextService,
  ) {}
  async getUserPublicKey(userId: number): Promise<UserPublicKey | null> {
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

  async decrypt(message: Message): Promise<string> {
    try {
      const { data, key, iv } = message as Message;
      const serverKey = await this.serverContextService.getCurrentServerKey();

      const decryptedKey = await CryptoUtil.decryptRSA(key, serverKey);
      const decryptedIv = await CryptoUtil.decryptRSA(iv, serverKey);

      const decipher = crypto.createDecipheriv(
        this.ALGORITHM,
        Buffer.from(decryptedKey, 'hex'),
        Buffer.from(decryptedIv, 'hex'),
      );
      let decrypted = decipher.update(data, 'base64', 'utf-8');
      decrypted += decipher.final('utf-8');

      return decrypted;
    } catch (error) {
      throw new HttpException(
        'Decryption failed: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async encrypt(data: string, userId: number): Promise<Message> {
    try {
      const userPublicKeyEntity = await this.getUserPublicKey(userId);
      if (!userPublicKeyEntity) {
        throw new HttpException(
          'User public key not found or expired',
          HttpStatus.BAD_REQUEST,
        );
      }

      const aesKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv(this.ALGORITHM, aesKey, iv);
      let encrypted = cipher.update(data, 'utf-8', 'base64');
      encrypted += cipher.final('base64');

      return {
        data: encrypted,
        key: await CryptoUtil.encryptRSA(
          aesKey.toString('hex'),
          userPublicKeyEntity.publicKeyPem,
        ),
        iv: await CryptoUtil.encryptRSA(
          iv.toString('hex'),
          userPublicKeyEntity.publicKeyPem,
        ),
      };
    } catch (error) {
      throw new HttpException(
        'Encryption failed: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

}
