import { Injectable } from '@nestjs/common';
import {
  generateKeyPairSync,
  publicEncrypt,
  privateDecrypt,
  constants,
} from 'crypto';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

@Injectable()
export class CryptoService {
  generateKeyPair(): KeyPair {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return {
      publicKey,
      privateKey,
    };
  }

  encryptWithPublicKey(data: string, publicKeyPem: string): string {
    try {
      const buffer = Buffer.from(data, 'utf8');
      const encrypted = publicEncrypt(
        {
          key: publicKeyPem,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        buffer,
      );
      return encrypted.toString('base64');
    } catch (error: any) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  decryptWithPrivateKey(encryptedData: string, privateKeyPem: string): string {
    try {
      const buffer = Buffer.from(encryptedData, 'base64');
      const decrypted = privateDecrypt(
        {
          key: privateKeyPem,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        buffer,
      );
      return decrypted.toString('utf8');
    } catch (error: any) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  validatePublicKey(publicKeyPem: string): boolean {
    try {
      const testData = 'test';
      this.encryptWithPublicKey(testData, publicKeyPem);
      return true;
    } catch {
      return false;
    }
  }
}
