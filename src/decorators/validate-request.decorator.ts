import { SetMetadata } from '@nestjs/common';

export const VALIDATE_REQUEST_KEY = 'validateRequest';
export const ValidateRequest = () => SetMetadata(VALIDATE_REQUEST_KEY, true);