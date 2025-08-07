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
import * as keysService from './keys.service';
import { ServerContextService } from '../servercontext/server-context.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterKeyDto } from './dto/register-key.dto';
import { EncryptionInterceptor } from 'src/interceptors/encrypt.interceptor';
import { DecryptionInterceptor } from 'src/interceptors/decrypt.interceptor';

@Controller('keys')
export class KeysController {
  constructor(
    private keysService: keysService.KeysService,
    private serverContextService: ServerContextService,
  ) {}

  @Get('server-public')
  @UseGuards(JwtAuthGuard)
  async getServerPublicKey() {
    const serverKey = await this.serverContextService.getCurrentServerKey();
    return {
      publicKey: serverKey.publicKeyPem,
      expiresAt: serverKey.expiresAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('register')
  async registerPublicKey(
    @Request() req: keysService.AuthenticatedRequest,
    @Body(ValidationPipe) registerKeyDto: RegisterKeyDto,
  ) {
    const userPublicKey = await this.keysService.registerUserPublicKey(
      req.user.userId,
      registerKeyDto.publicKey,
    );

    return {
      id: userPublicKey.id,
      expiresAt: userPublicKey.expiresAt,
      isActive: userPublicKey.isActive,
      createdAt: userPublicKey.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-key')
  @UseInterceptors(EncryptionInterceptor)
  async getMyKey(@Request() req: keysService.AuthenticatedRequest) {
    const key = await this.keysService.getUserPublicKey(req.user.userId);

    if (!key) {
      return null;
    }

    return {
      id: key.id,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
      isExpired: new Date() > key.expiresAt,
    };
  }
}
