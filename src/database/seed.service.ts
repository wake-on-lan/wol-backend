import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import { User } from './entities/user.entity';
import { ServerKeyService } from '../keys/server-key.service';
import { ConfigService } from '@nestjs/config';
import { CryptoUtil } from 'src/keys/crypto.util';
import { ServerKey } from './entities/server-key.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ServerKey)
    private serverKeyRepository: Repository<ServerKey>,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('🌱 Starting database seeding...');
    try {
      await this.seedUsers();
      this.logger.log('✅ Database seeding completed successfully');
    } catch (error) {
      this.logger.error('❌ Database seeding failed', error);
      process.exit(1);
    }
  }

  private async seedUsers() {
      let existingUsers = 0;
    if (this.configService.get<string>('database.type') === 'sqlite') {
      const databasePath = this.configService.get('database.name');

      // Check if database file exists, if not, the count query will fail
      if (fs.existsSync(databasePath)) {
        try {
          existingUsers = await this.userRepository.count();
        } catch (error) {
          this.logger.warn(
            'Failed to count existing users, assuming database needs initialization',
            error,
          );
          existingUsers = 0;
        }
      }
    }

    if (existingUsers === 0) {
      this.logger.log('Seeding initial users...');

      const users = [
        { username: 'admin', password: 'admin123' },
        { username: 'user', password: 'user123' },
        { username: 'testuser', password: 'test123' },
      ];

      for (const userData of users) {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(userData.password, saltRounds);

        const user = this.userRepository.create({
          username: userData.username,
          passwordHash,
        });

        await this.userRepository.save(user);
        this.logger.log(`Created user: ${userData.username}`);
      }
    } else {
      this.logger.log('Users already exist, skipping seed');
    }
  }
}
