import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  ValidationPipe,
  UseInterceptors,
} from '@nestjs/common';
import * as userKeyService from './user-key.service';
import { ServerKeyService } from './server-key.service';
import { UserKeyService } from './user-key.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RegisterKeyDto } from './dto/register-key.dto';
import { EncryptionInterceptor } from 'src/interceptors/encrypt.interceptor';
import { DecryptionInterceptor } from 'src/interceptors/decrypt.interceptor';

@Controller('keys')
export class KeysController {
  constructor(
    private userKeyService: UserKeyService,
    private serverKeyService: ServerKeyService,
  ) {}

  @Get('server-public')
  async getServerPublicKey() {
    const serverKey = await this.serverKeyService.getCurrentServerKey();
    return {
      publicKey: serverKey.publicKeyPem,
      expiresAt: serverKey.expiresAt.getTime(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('register')
  @UseInterceptors(EncryptionInterceptor)
  async registerPublicKey(
    @Request() req: userKeyService.AuthenticatedRequest,
    @Body(ValidationPipe) registerKeyDto: RegisterKeyDto,
  ) {
    const userPublicKey = await this.userKeyService.registerUserPublicKey(
      req.user.userId,
      registerKeyDto.publicKey,
    );

    return {
      id: userPublicKey.id,
      expiresAt: userPublicKey.expiresAt.getTime(),
      isActive: userPublicKey.isActive,
      createdAt: userPublicKey.createdAt.getTime(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-key')
  @UseInterceptors(EncryptionInterceptor)
  async getMyKey(@Request() req: userKeyService.AuthenticatedRequest) {
    const key = await this.userKeyService.getUserPublicKey(req.user.userId);

    if (!key) {
      return null;
    }

    return {
      id: key.id,
      expiresAt: key.expiresAt.getTime(),
      isActive: key.isActive,
      createdAt: key.createdAt.getTime(),
    };
  }
}
