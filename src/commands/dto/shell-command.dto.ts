import { IsString, IsNotEmpty, IsOptional, IsNumber, IsPort, ValidateIf } from 'class-validator';

export class ShellCommandDto {
  @IsString()
  @IsNotEmpty()
  host: string;

  @IsNumber()
  @IsPort()
  port: number;

  @IsString()
  @IsNotEmpty()
  user: string;

  @IsString()
  @IsNotEmpty()
  command: string;

  @ValidateIf((o) => !o.privateKey)
  @IsString()
  @IsNotEmpty()
  password?: string;

  @ValidateIf((o) => !o.password)
  @IsString()
  @IsNotEmpty()
  privateKey?: string | Buffer;
}