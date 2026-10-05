import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const BYPASS_RESPONSE_TRANSFORM_KEY = 'bypassResponseTransform';
export const BypassResponseTransform = () =>
  SetMetadata(BYPASS_RESPONSE_TRANSFORM_KEY, true);
