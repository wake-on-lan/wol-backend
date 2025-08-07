import { IsNotEmpty, IsString } from "class-validator";

export class RegisterKeyDto {
  @IsString()
  @IsNotEmpty()
  publicKey: string;
}