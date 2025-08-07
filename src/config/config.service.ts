import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

export interface DatabaseConfig {
  type: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
}

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  allowedOrigins: string[];
}

export interface EncryptionConfig {
  databaseMasterKey: string;
}

@Injectable()
export class AppConfigService {
  constructor(private configService: NestConfigService) {}

  get database(): DatabaseConfig {
    return {
      type: this.configService.get<string>('DATABASE_TYPE', 'sqlite'),
      database: this.configService.get<string>('DATABASE_PATH', 'encrypted-relay.db'),
      synchronize: this.configService.get<boolean>('DATABASE_SYNCHRONIZE', true),
      logging: this.configService.get<boolean>('DATABASE_LOGGING', false),
    };
  }

  get jwt(): JWTConfig {
    return {
      secret: this.configService.get<string>('JWT_SECRET', 'secure-jwt-secret-key-change-in-production'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '24h'),
    };
  }

  get server(): ServerConfig {
    return {
      port: this.configService.get<number>('PORT', 3000),
      nodeEnv: this.configService.get<string>('NODE_ENV', 'development'),
      allowedOrigins: this.configService
        .get<string>('ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3001')
        .split(','),
    };
  }

  get encryption(): EncryptionConfig {
    const masterKey = this.configService.get<string>('DATABASE_MASTER_KEY');
    
    if (!masterKey) {
      throw new Error(
        'DATABASE_MASTER_KEY environment variable is required for database encryption. ' +
        'Generate one using: openssl rand -hex 32'
      );
    }

    if (masterKey.length !== 64) {
      throw new Error('DATABASE_MASTER_KEY must be 64 characters (32 bytes) in hex format');
    }

    return {
      databaseMasterKey: masterKey,
    };
  }

  get isDevelopment(): boolean {
    return this.server.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.server.nodeEnv === 'production';
  }
}