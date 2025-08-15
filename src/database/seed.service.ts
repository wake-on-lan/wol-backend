import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { User } from './entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption/encryption.service';

interface SeedUser {
  username: string;
  password: string;
}

interface EncryptedSeedData {
  users: SeedUser[];
}

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private encryptionService: EncryptionService,
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
    if (this.configService.get<string>('database.type')?.includes('sqlite')) {
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

      // Try to load users from encrypted JSON file in production
      let users = await this.loadEncryptedUsers();
      
      // Fall back to default users if no encrypted file or not in production
      if (!users || users.length === 0) {
        users = [
          { username: 'admin', password: 'admin123' },
          { username: 'user', password: 'user123' },
          { username: 'testuser', password: 'test123' },
        ];
      }

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

  private async loadEncryptedUsers(): Promise<SeedUser[]> {
    // Only load encrypted users in production
    const nodeEnv = this.configService.get<string>('server.nodeEnv') || 'development';
    if (nodeEnv !== 'production') {
      this.logger.log('Not in production environment, skipping encrypted user file');
      return [];
    }

    const encryptedFilePath = path.join(process.cwd(), 'users.encrypted.json');
    
    if (!fs.existsSync(encryptedFilePath)) {
      this.logger.warn('Encrypted users file not found at: ' + encryptedFilePath);
      return [];
    }

    try {
      this.logger.log('Loading users from encrypted file...');
      const encryptedData = fs.readFileSync(encryptedFilePath, 'utf8');
      const decryptedJson = this.encryptionService.decrypt(encryptedData);
      const seedData: EncryptedSeedData = JSON.parse(decryptedJson);

      if (!seedData.users || !Array.isArray(seedData.users)) {
        throw new Error('Invalid encrypted seed data format');
      }

      // Validate user data structure
      for (const user of seedData.users) {
        if (!user.username || !user.password) {
          throw new Error('Invalid user data: username and password are required');
        }
      }

      this.logger.log(`Loaded ${seedData.users.length} users from encrypted file`);
      return seedData.users;
    } catch (error) {
      this.logger.error('Failed to load encrypted users file', error);
      throw new Error('Unable to decrypt users file. Please check the encryption key and file format.');
    }
  }
}
