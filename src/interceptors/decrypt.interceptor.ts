import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { CryptoService } from 'src/keys/crypto.service';
import { Reflector } from '@nestjs/core';
import { Message } from './interceptor.types';

@Injectable()
export class DecryptionInterceptor implements NestInterceptor {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const validateRequest = this.reflector.get<boolean>(
      'validateRequest',
      context.getHandler(),
    );

    if (validateRequest) {
      const request = context.switchToHttp().getRequest<Request>();

      if (!request.body)
        throw new HttpException('no data was sent', HttpStatus.BAD_REQUEST);

      const isValidMessage = this.isValidMessageData(request.body);

      if (!isValidMessage)
        throw new HttpException(
          'Invalid message data sent',
          HttpStatus.BAD_REQUEST,
        );
      const encryptedData = await this.cryptoService.decrypt(request.body);
      request.body = JSON.parse(encryptedData);
    }

    return next.handle();
  }

  isValidMessageData(message: Message): boolean {
    if (!message.data || typeof message.data !== 'string') {
      console.error('Invalid data structure:', message);
      return false;
    }

    if (!message.iv || typeof message.iv !== 'string') {
      console.error('Invalid IV structure:', message);
      return false;
    }

    if (!message.key || typeof message.key !== 'string') {
      console.error('Invalid message structure:', message);
      return false;
    }

    return true;
  }
}
