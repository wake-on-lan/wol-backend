import { Module } from '@nestjs/common';
import { CommandsService } from './commands.service';
import { CommandsController } from './commands.controller';
import { KeysModule } from 'src/keys/keys.module';


@Module({
  imports: [KeysModule],
  controllers: [CommandsController],
  providers: [CommandsService],
})
export class CommandsModule {}
