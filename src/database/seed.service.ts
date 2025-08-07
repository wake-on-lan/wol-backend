import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import { User } from '../entities/user.entity';
import { KeysService } from '../keys/keys.service';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private keysService: KeysService,
    private configService: AppConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('🌱 Starting database seeding...');
    try {
      await this.seedUsers();
      await this.initializeServerKey();
      this.logger.log('✅ Database seeding completed successfully');
    } catch (error) {
      this.logger.error('❌ Database seeding failed', error);
      throw error;
    }
  }

  private async seedUsers() {
    const databasePath = this.configService.database.database;
    
    // Check if database file exists, if not, the count query will fail
    let existingUsers = 0;
    if (fs.existsSync(databasePath)) {
      try {
        existingUsers = await this.userRepository.count();
      } catch (error) {
        this.logger.warn('Failed to count existing users, assuming database needs initialization', error);
        existingUsers = 0;
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

  private async initializeServerKey() {
    try {
      const serverKey = await this.keysService.getCurrentServerKey();
      this.logger.log(
        `Server key initialized, expires at: ${serverKey.expiresAt.toISOString()}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize server key', error);
    }
  }
}
