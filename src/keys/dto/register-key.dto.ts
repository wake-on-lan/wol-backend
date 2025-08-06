import { IsString, IsNotEmpty } from 'class-validator';

export class RegisterKeyDto {
  @IsString()
  @IsNotEmpty()
  publicKey: string;
}
