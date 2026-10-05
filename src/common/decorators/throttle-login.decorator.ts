import { SetMetadata } from '@nestjs/common';

export const THROTTLE_LOGIN_KEY = 'throttleLogin';
export const ThrottleLogin = () => SetMetadata(THROTTLE_LOGIN_KEY, true);
