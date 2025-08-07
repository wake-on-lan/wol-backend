import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import { KeysService } from './keys.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterKeyDto } from './dto/register-key.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('keys')
export class KeysController {
  constructor(private keysService: KeysService) {}

  @Get('server-public')
  async getServerPublicKey() {
    const serverKey = await this.keysService.getCurrentServerKey();
    return {
      publicKey: serverKey.publicKeyPem,
      expiresAt: serverKey.expiresAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('register')
  async registerPublicKey(
    @Request() req: AuthenticatedRequest,
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
  async getMyKey(@Request() req: AuthenticatedRequest) {
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

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getKeyStatus(@Request() req: AuthenticatedRequest) {
    const userKey = await this.keysService.getUserActivePublicKey(
      req.user.userId,
    );
    const serverKey = await this.keysService.getCurrentServerKey();

    const now = new Date();
    const warningTime = new Date();
    warningTime.setHours(warningTime.getHours() + 2);

    return {
      userKey: userKey
        ? {
            expiresAt: userKey.expiresAt,
            isExpiringSoon: userKey.expiresAt < warningTime,
            isExpired: userKey.expiresAt < now,
          }
        : null,
      serverKey: {
        expiresAt: serverKey.expiresAt,
        isExpiringSoon: serverKey.expiresAt < warningTime,
      },
    };
  }
}
