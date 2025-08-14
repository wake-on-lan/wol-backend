import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { CommandsService, UpResult } from './commands.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { DecryptionInterceptor } from '../interceptors/decrypt.interceptor';
import { EncryptionInterceptor } from '../interceptors/encrypt.interceptor';
import { ValidateRequest } from '../decorators/validate-request.decorator';
import { ShellCommandDto } from './dto/shell-command.dto';
import { WakeOnLanDto } from './dto/wake-on-lan.dto';
import { PingResponse } from 'ping';

@Controller('commands')
export class CommandsController {
  constructor(private commandsService: CommandsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('scan-devices')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(EncryptionInterceptor)
  async scanDevices() {
    const devices = await this.commandsService.scanLocalDevices();
    return devices;
  }

  @UseGuards(JwtAuthGuard)
  @ValidateRequest()
  @Post('shell')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(DecryptionInterceptor, EncryptionInterceptor)
  async executeShell(@Body(ValidationPipe) payload: ShellCommandDto) {
    const result = await this.commandsService.executeShellCommand(payload);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @ValidateRequest()
  @Post('wake-on-lan')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(DecryptionInterceptor, EncryptionInterceptor)
  async wakeOnLan(@Body(ValidationPipe) payload: WakeOnLanDto) {
    const result = await this.commandsService.sendWakeOnLan(payload);
    return result;
  }

  @Get('up')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(EncryptionInterceptor)
  async up(@Query('hostname') hostname: string): Promise<PingResponse> {
    const result = await this.commandsService.checkHost(hostname);
    return result;
  }

  @Get('checkHttpsAvailability')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(EncryptionInterceptor)
  async checkHttpsAvailability(
    @Query('hostname') hostname: string,
  ): Promise<UpResult> {
    const result = await this.commandsService.checkHttpsAvailability(hostname);
    return result;
  }
}
