import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestWithContext } from '../middleware/request-context.middleware';

/**
 * Logs failed HTTP requests when this interceptor is registered directly.
 * Successful requests are intentionally silent.
 */
@Injectable()
/** Keeps failed-request logging available for consumers that register this interceptor directly. */
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const requestId = (request as RequestWithContext).requestId || '-';
    const now = Date.now();

    return next.handle().pipe(
      tap({
        error: (error: unknown): void => {
          const exception = error as {
            getStatus?: () => number;
          };
          const statusCode = exception.getStatus?.() ?? 500;
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          this.logger[statusCode >= 500 ? 'error' : 'warn'](
            `${method} ${url} ${statusCode} ${Date.now() - now}ms request_id=${requestId} - ${errorMessage}`,
            error instanceof Error ? error.stack : undefined,
          );
        },
      }),
    );
  }
}
