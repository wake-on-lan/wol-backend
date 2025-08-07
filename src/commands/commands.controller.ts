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
} from '@nestjs/common';
import { CommandsService } from './commands.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DecryptionInterceptor } from '../interceptors/decrypt.interceptor';
import { EncryptionInterceptor } from '../interceptors/encrypt.interceptor';
import { ValidateRequest } from '../decorators/validate-request.decorator';
import { ShellCommandDto } from './dto/shell-command.dto';
import { WakeOnLanDto } from './dto/wake-on-lan.dto';

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
  async executeShell(
    @Body(ValidationPipe) payload: ShellCommandDto,
  ) {
    const result = await this.commandsService.executeShellCommand(payload);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @ValidateRequest()
  @Post('wake-on-lan')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(DecryptionInterceptor, EncryptionInterceptor)
  async wakeOnLan(
    @Body(ValidationPipe) payload: WakeOnLanDto,
  ) {
    const result = await this.commandsService.sendWakeOnLan(payload);
    return result;
  }
}
