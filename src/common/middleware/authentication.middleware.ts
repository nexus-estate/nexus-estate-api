import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithToken = Request & {
  accessToken?: string;
};

/** Extracts a bearer token; realm guards still validate identity and authority. */
@Injectable()
export class AuthenticationMiddleware implements NestMiddleware {
  use(
    request: RequestWithToken,
    _response: Response,
    next: NextFunction,
  ): void {
    const match = request.headers.authorization?.match(/^Bearer ([^\s]+)$/);
    if (match) request.accessToken = match[1];
    next();
  }
}
