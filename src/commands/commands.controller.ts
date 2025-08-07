import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandsService } from './commands.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShellCommandDto } from './dto/shell-command.dto';
import { WakeOnLanDto } from './dto/wake-on-lan.dto';

@Controller('commands')
export class CommandsController {
  constructor(private commandsService: CommandsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('scan-devices')
  @HttpCode(HttpStatus.OK)
  async scanDevices() {
    const devices = await this.commandsService.scanLocalDevices();
    return devices;
  }

  @UseGuards(JwtAuthGuard)
  @Post('shell')
  @HttpCode(HttpStatus.OK)
  async executeShell(
    @Body(ValidationPipe) payload: ShellCommandDto,
  ) {
    const result = await this.commandsService.executeShellCommand(payload);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('wake-on-lan')
  @HttpCode(HttpStatus.OK)
  async wakeOnLan(
    @Body(ValidationPipe) payload: WakeOnLanDto,
  ) {
    const result = await this.commandsService.sendWakeOnLan(payload);
    return result;
  }
}
