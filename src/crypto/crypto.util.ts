import { HttpException, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import { ServerKey } from 'src/database/entities/server-key.entity';
import { KeyPair } from './crypto.service';

export class CryptoUtil {
      public static async encryptRSA(
    data: string,
    userPublicKey: string,
  ): Promise<string> {
    try {
      const buffer = Buffer.from(data, 'utf-8');

      // Use user's public key to encrypt data so only user can decrypt with their private key
      const encrypted = crypto.publicEncrypt(
        {
          key: userPublicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        buffer,
      );

      return encrypted.toString('base64');
    } catch (error) {
      throw new HttpException(
        'RSA encryption failed: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  public static async decryptRSA(
    data: string,
    serverKey: ServerKey,
  ): Promise<string> {
    try {
      const buffer = Buffer.from(data, 'base64');

      // Use server's private key to decrypt data encrypted with server's public key
      const decrypted = crypto.privateDecrypt(
        {
          key: serverKey.privateKeyPem,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        buffer,
      );

      return decrypted.toString('utf-8');
    } catch (error) {
      throw new HttpException(
        'RSA decryption failed: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  public static generateKeyPair(): KeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
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
}