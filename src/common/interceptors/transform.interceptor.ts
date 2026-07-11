import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponse<T> {
  status: boolean;
  data: T;
  timestamp: string;
  path: string;
}

/**
 * Transforms all successful responses into a standardized envelope.
 *
 * Pass-through paths (not wrapped):
 *  - /swagger, /docs, /favicon, /health
 *  - Non-JSON content types (file streams, etc.)
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  SuccessResponse<T> | T
> {
  private readonly passThroughPatterns: RegExp[] = [
    /^\/swagger/,
    /^\/docs/,
    /^\/favicon/,
    /^\/health$/,
  ];

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T> | T> {
    const request = context.switchToHttp().getRequest<Request>();
    const path: string = request.url || '';

    if (this.passThroughPatterns.some((pattern) => pattern.test(path))) {
      return next.handle() as Observable<SuccessResponse<T> | T>;
    }

    const response = context.switchToHttp().getResponse<Response>();
    const contentType = response.getHeader('Content-Type');
    if (typeof contentType === 'string' && !contentType.includes('json')) {
      return next.handle() as Observable<SuccessResponse<T> | T>;
    }

    return next.handle().pipe(
      map((data: T) => ({
        status: true,
        data,
        timestamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}
