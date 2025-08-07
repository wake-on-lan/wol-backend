import { Module } from '@nestjs/common';
import { CommandsService } from './commands.service';
import { CommandsController } from './commands.controller';
import { CryptoModule } from 'src/crypto/crypto.module';

@Module({
  imports: [CryptoModule],
  controllers: [CommandsController],
  providers: [CommandsService],
})
export class CommandsModule {}
