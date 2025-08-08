import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { CryptoService } from 'src/keys/crypto.service';

@Injectable()
export class EncryptionInterceptor implements NestInterceptor {
  constructor(
    private readonly cryptoService: CryptoService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    return next.handle().pipe(
      mergeMap((data) => {
        if (data) {
          return from(this.cryptoService.encrypt(JSON.stringify(data), user.userId));
        }
        return from(Promise.resolve(data));
      }),
    );
  }
}
