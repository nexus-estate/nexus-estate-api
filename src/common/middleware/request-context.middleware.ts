import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { API_LANGUAGE_HEADER, resolveApiLanguage } from '../i18n/language';

export const REQUEST_ID_HEADER = 'x-request-id';

export type RequestWithContext = Request & {
  requestId: string;
};

function getIncomingRequestId(request: Request): string | undefined {
  const value = request.headers[REQUEST_ID_HEADER];
  const requestId = Array.isArray(value) ? value[0] : value;
  return typeof requestId === 'string' && requestId.trim()
    ? requestId.trim()
    : undefined;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = getIncomingRequestId(request) || randomUUID();

    (request as RequestWithContext).requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.setHeader(
      'content-language',
      resolveApiLanguage(request.headers[API_LANGUAGE_HEADER]),
    );
    next();
  }
}
