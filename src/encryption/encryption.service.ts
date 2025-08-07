import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyDerivationIterations = 100000;
  private masterKey: Buffer;

  constructor(private configService: AppConfigService) {
    this.initializeMasterKey();
  }

  private initializeMasterKey() {
    const masterKeyString = this.configService.encryption.databaseMasterKey;
    this.masterKey = Buffer.from(masterKeyString, 'hex');    
    this.logger.log('Database encryption initialized');
  }

  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    try {
      const salt = crypto.randomBytes(16);
      const key = crypto.pbkdf2Sync(this.masterKey, salt, this.keyDerivationIterations, 32, 'sha256');
      const iv = crypto.randomBytes(12);

      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Format: salt(16) + iv(12) + authTag(16) + encrypted
      const result = Buffer.concat([
        salt,
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return result.toString('base64');
    } catch (error) {
      this.logger.error('Failed to encrypt data', error);
      throw new Error('Encryption failed');
    }
  }

  decrypt(encryptedData: string): string {
    if (!encryptedData) return encryptedData;

    try {
      const data = Buffer.from(encryptedData, 'base64');
      
      const salt = data.subarray(0, 16);
      const iv = data.subarray(16, 28);
      const authTag = data.subarray(28, 44);
      const encrypted = data.subarray(44);
      
      const key = crypto.pbkdf2Sync(this.masterKey, salt, this.keyDerivationIterations, 32, 'sha256');
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, undefined, 'utf-8');
      decrypted += decipher.final('utf-8');
      this.logger.log('Decrypted data successfully');
      return decrypted;
    } catch (error) {
      this.logger.error('Failed to decrypt data', error);
      throw new Error('Decryption failed');
    }
  }
}