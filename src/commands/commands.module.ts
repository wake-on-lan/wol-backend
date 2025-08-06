import { Module } from '@nestjs/common';
import { CommandsService } from './commands.service';
import { CommandsController } from './commands.controller';
import { KeysModule } from '../keys/keys.module';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [KeysModule, CryptoModule],
  controllers: [CommandsController],
  providers: [CommandsService],
})
export class CommandsModule {}
