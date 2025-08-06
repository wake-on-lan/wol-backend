import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UserPublicKey } from '../entities/user-public-key.entity';
import { ServerKey } from '../entities/server-key.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: 'encrypted-relay.db',
  entities: [User, UserPublicKey, ServerKey],
  synchronize: true,
  logging: false,
};
