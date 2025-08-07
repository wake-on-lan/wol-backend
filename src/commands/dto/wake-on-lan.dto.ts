import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class WakeOnLanDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, {
    message: 'MAC address must be in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX',
  })
  macAddress: string;
}