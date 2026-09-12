import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestWithContext } from '../middleware/request-context.middleware';

/**
 * Logs every incoming HTTP request and its response status.
 * Includes method, URL, status code, and duration in milliseconds.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const requestId = (request as RequestWithContext).requestId || '-';
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: (): void => {
          const response = context.switchToHttp().getResponse<Response>();
          const { statusCode } = response;
          this.logger.log(
            `${method} ${url} ${statusCode} ${Date.now() - now}ms request_id=${requestId}`,
          );
        },
        error: (error: Error): void => {
          this.logger.error(
            `${method} ${url} ${Date.now() - now}ms request_id=${requestId} - ${error.message}`,
          );
        },
      }),
    );
  }
}
