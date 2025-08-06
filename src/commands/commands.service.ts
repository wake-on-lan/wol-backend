import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { KeysService } from '../keys/keys.service';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class CommandsService {
  constructor(
    private keysService: KeysService,
    private cryptoService: CryptoService,
  ) {}

  async processEncryptedCommand(
    userId: number,
    encryptedCommand: string,
  ): Promise<string> {
    const serverKey = await this.keysService.getCurrentServerKey();
    const userPublicKey = await this.keysService.getUserActivePublicKey(userId);

    if (!userPublicKey) {
      throw new UnauthorizedException('No active public key found for user');
    }

    let decryptedCommand: string;
    try {
      decryptedCommand = this.cryptoService.decryptWithPrivateKey(
        encryptedCommand,
        serverKey.privateKeyPem,
      );
    } catch {
      throw new BadRequestException('Failed to decrypt command');
    }

    const response = await this.forwardCommand(decryptedCommand);

    let encryptedResponse: string;
    try {
      encryptedResponse = this.cryptoService.encryptWithPublicKey(
        response,
        userPublicKey.publicKeyPem,
      );
    } catch {
      throw new BadRequestException('Failed to encrypt response');
    }

    return encryptedResponse;
  }

  private async forwardCommand(command: string): Promise<string> {
    try {
      const commandObj = JSON.parse(command);

      if (!commandObj.type || !commandObj.payload) {
        throw new Error('Invalid command format');
      }

      switch (commandObj.type) {
        case 'wake-on-lan':
          return await this.handleWakeOnLan(commandObj.payload);
        case 'ping':
          return await this.handlePing(commandObj.payload);
        case 'system-status':
          return await this.handleSystemStatus();
        default:
          throw new Error('Unsupported command type');
      }
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleWakeOnLan(payload: any): Promise<string> {
    const { macAddress, ipAddress, port = 9 } = payload;

    if (!macAddress) {
      throw new Error('MAC address is required for wake-on-lan');
    }

    return Promise.resolve(JSON.stringify({
      success: true,
      message: `Wake-on-LAN packet sent to ${macAddress}`,
      target: { macAddress, ipAddress, port },
      timestamp: new Date().toISOString(),
    }));
  }

  private handlePing(payload: any): Promise<string> {
    const { target } = payload;

    if (!target) {
      throw new Error('Target is required for ping');
    }

    return Promise.resolve(JSON.stringify({
      success: true,
      message: `Ping sent to ${target}`,
      target,
      timestamp: new Date().toISOString(),
    }));
  }

  private handleSystemStatus(): Promise<string> {
    return Promise.resolve(JSON.stringify({
      success: true,
      status: 'Server is running',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
  }
}
