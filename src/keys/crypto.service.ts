import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { Message } from 'src/interceptors/interceptor.types';
import { ServerKeyService } from 'src/keys/server-key.service';
import { CryptoUtil } from './crypto.util';
import { UserKeyService } from 'src/keys/user-key.service';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

@Injectable()
export class CryptoService {
  private readonly ALGORITHM = 'aes-256-cbc';

  constructor(private serverKeyService: ServerKeyService, private userKeyService: UserKeyService) {}

  async decrypt(message: Message): Promise<string> {
    try {
      const { data, key, iv } = message as Message;
      const serverKey = await this.serverKeyService.getCurrentServerKey();

      const decryptedKey = await CryptoUtil.decryptRSA(key, serverKey);
      const decryptedIv = await CryptoUtil.decryptRSA(iv, serverKey);
      const decipher = crypto.createDecipheriv(
        this.ALGORITHM,
        Buffer.from(decryptedKey, 'base64'),
        Buffer.from(decryptedIv, 'base64'),
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
      const userPublicKeyEntity = await this.userKeyService.getUserPublicKey(userId);
      
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
          aesKey.toString('base64'),
          userPublicKeyEntity.publicKeyPem,
        ),
        iv: await CryptoUtil.encryptRSA(
          iv.toString('base64'),
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
