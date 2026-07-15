import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Extracts `req.user` from the current request.
 *
 * Must only be used on routes protected by an authentication guard
 * (e.g. LocalAuthGuard, JwtAuthGuard) which guarantees `req.user` is defined.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);
