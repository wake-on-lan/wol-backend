import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandsService } from './commands.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SendCommandDto } from './dto/send-command.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('commands')
export class CommandsController {
  constructor(private commandsService: CommandsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendCommand(
    @Request() req: AuthenticatedRequest,
    @Body(ValidationPipe) sendCommandDto: SendCommandDto,
  ) {
    const encryptedResponse =
      await this.commandsService.processEncryptedCommand(
        req.user.userId,
        sendCommandDto.encryptedCommand,
      );

    return {
      encryptedResponse,
      timestamp: new Date().toISOString(),
    };
  }
}
