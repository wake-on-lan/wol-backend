import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { UserPublicKey } from './entities/user-public-key.entity';
import { ServerKey } from './entities/server-key.entity';

export const createDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: configService.get<string>('database.type') as any,
  database: configService.get<string>('database.name'),
  entities: [User, UserPublicKey, ServerKey],
  synchronize: configService.get<boolean>('database.synchronize'),
  logging: configService.get<boolean>('database.logging'),
});

// Legacy export for backward compatibility
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'better-sqlite3',
  database: 'encrypted-relay.db',
  entities: [User, UserPublicKey, ServerKey],
  synchronize: true,
  logging: false,
};
