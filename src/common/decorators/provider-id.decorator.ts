import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Reads the optional, server-validated provider context header. */
export const ProviderId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<Request>();
    const value = request.header('x-provider-id');
    return value?.trim() || undefined;
  },
);
