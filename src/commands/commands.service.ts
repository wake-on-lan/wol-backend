import {
  Injectable,
} from '@nestjs/common';
import { Client } from 'ssh2';
import * as wol from 'wake_on_lan';
import find from 'local-devices';
import { ShellCommandDto } from './dto/shell-command.dto';

export interface Device {
  name: string;
  mac: string;
  ip: string;
}

export interface SshConfig {
  host: string;
  port: number;
  user: string;
  command: string;
  password?: string;
  privateKey?: string | Buffer;
}


export interface ShellCommandResponse {
  success: boolean;
  command: string;
  exitStatus: number;
  message: string;
  timestamp: string;
}

export interface WakeOnLanPayload {
  macAddress: string;
}

export interface WakeOnLanResponse {
  success: boolean;
  message?: string;
  target?: {
    macAddress: string;
  };
  timestamp: string;
  error?: string;
}

@Injectable()
export class CommandsService {
  constructor(
  ) {}

  async scanLocalDevices(): Promise<Device[]> {
    const devices = await find();
    const uniqueDevicesMap: Map<string, Device> = new Map();
    devices.forEach((device) => {
      if (!uniqueDevicesMap.has(device.name)) {
        uniqueDevicesMap.set(device.name, {
          name: device.name,
          mac: device.mac,
          ip: device.ip,
        });
      }
    });
    return Array.from(uniqueDevicesMap.values());
  }

  async executeShellCommand(sshConfig: ShellCommandDto): Promise<ShellCommandResponse> {
    if (!this.isValidSshConfig(sshConfig)) {
      return {
        success: false,
        command: sshConfig.command,
        exitStatus: -1,
        message: 'Invalid SSH configuration',
        timestamp: new Date().toLocaleString(),
      };
    }

    const { command, ...config } = sshConfig;

    if (config.privateKey) {
      config.privateKey = Buffer.from(config.privateKey.toString(), 'base64');
    }

    const sshClient: Client = new Client();
    return new Promise<ShellCommandResponse>((resolve) => {
      let stdout: string = '';
      let stderr: string = '';

      sshClient.on('error', (err: Error) => {
        resolve({
          success: false,
          exitStatus: -1,
          message: `SSH connection error: ${err.message}`,
          command,
          timestamp: new Date().toLocaleString(),
        });
      });

      sshClient.on('ready', () => {
        sshClient.exec(command, (err: Error, stream) => {
          if (err) {
            sshClient.end();
            return resolve({
              success: false,
              exitStatus: -1,
              message: `Failed to execute command: "${command}". Error: ${err.message}`,
              command,
              timestamp: new Date().toLocaleString(),
            });
          }

          stream.on('data', (data: Buffer) => {
            stdout += data.toString() + '\n';
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString() + '\n';
          });

          stream.on('close', (code: number) => {
            sshClient.end();
            if (code === 0) {
              resolve({
                success: true,
                exitStatus: code,
                message: stdout,
                command,
                timestamp: new Date().toLocaleString(),
              });
            } else {
              resolve({
                success: false,
                exitStatus: code,
                message: stderr,
                command,
                timestamp: new Date().toLocaleString(),
              });
            }
          });
        });
      });
      sshClient.connect(config);
    });
  }

  private isValidSshConfig(config: SshConfig): boolean {
    if (!config.host || typeof config.host !== 'string') {
      return false;
    }

    if (
      !config.port ||
      typeof config.port !== 'number' ||
      config.port <= 0 ||
      config.port > 65535
    ) {
      return false;
    }

    if (!config.user || typeof config.user !== 'string') {
      return false;
    }

    if (!config.command || typeof config.command !== 'string') {
      return false;
    }

    if (!config.password && !config.privateKey) {
      return false;
    }

    return true;
  }

  async sendWakeOnLan(payload: WakeOnLanPayload): Promise<WakeOnLanResponse> {
    try {
      const { macAddress } = payload;
      
      if (!macAddress || !/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(macAddress)) {
        throw new Error('Invalid MAC address format');
      }

      return new Promise((resolve) => {
        wol.wake(macAddress, (error: any) => {
          if (error) {
            resolve({
              success: false,
              error: error.message,
              timestamp: new Date().toLocaleString(),
            });
          } else {
            resolve({
              success: true,
              message: `Wake-on-LAN packet sent successfully`,
              target: { macAddress },
              timestamp: new Date().toLocaleString(),
            });
          }
        });
      });
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toLocaleString(),
      };
    }
  }

}
