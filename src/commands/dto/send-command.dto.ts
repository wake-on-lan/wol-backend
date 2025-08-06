import { IsString, IsNotEmpty } from 'class-validator';

export class SendCommandDto {
  @IsString()
  @IsNotEmpty()
  encryptedCommand: string;
}
