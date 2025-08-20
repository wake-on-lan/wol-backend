import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../database/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { UserKeyService } from 'src/keys/user-key.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private userKeyService: UserKeyService,
    private jwtService: JwtService,
  ) {}

  async validateUser(
    username: string,
    password: string,
  ): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(
    { username, password, publicKey }: LoginDto,
  ): Promise<{ access_token: string, user: Omit<User, 'passwordHash'> }> {
    const user = await this.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.userKeyService.registerUserPublicKey(user.id, publicKey);

    return {
      user,
      access_token: this.jwtService.sign({ username: user.username, sub: user.id }),
    };
  }

  async findUserById(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }
}
