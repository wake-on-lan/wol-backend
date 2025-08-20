import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { DecryptionInterceptor } from 'src/interceptors/decrypt.interceptor';
import { EncryptionInterceptor } from 'src/interceptors/encrypt.interceptor';
import { ValidateRequest } from 'src/decorators/validate-request.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @UseInterceptors(DecryptionInterceptor, EncryptionInterceptor)
  @ValidateRequest()
  async login(@Body(ValidationPipe) payload: LoginDto) {
    const result = await this.authService.login(payload);

    return { access_token: result.access_token, userId: result.user.id };
  }
}
