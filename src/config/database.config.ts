import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { UserPublicKey } from '../entities/user-public-key.entity';
import { ServerKey } from '../entities/server-key.entity';

export const createDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: configService.get<string>('DATABASE_TYPE', 'sqlite') as any,
  database: configService.get<string>('DATABASE_PATH', 'encrypted-relay.db'),
  entities: [User, UserPublicKey, ServerKey],
  synchronize: configService.get<boolean>('DATABASE_SYNCHRONIZE', true),
  logging: configService.get<boolean>('DATABASE_LOGGING', false),
});

// Legacy export for backward compatibility
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: 'encrypted-relay.db',
  entities: [User, UserPublicKey, ServerKey],
  synchronize: true,
  logging: false,
};
