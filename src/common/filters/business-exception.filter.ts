import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';
import {
  REQUEST_ID_HEADER,
  RequestWithContext,
} from '../middleware/request-context.middleware';

@Catch(BusinessException)
export class BusinessExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(BusinessExceptionFilter.name);

  catch(exception: BusinessException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const body = exception.getResponse() as Record<string, unknown>;
    const requestId =
      (request as RequestWithContext).requestId ||
      (typeof request.header === 'function'
        ? request.header(REQUEST_ID_HEADER)
        : undefined);

    this.logger.warn(
      `Business exception: ${exception.errorCode} request_id=${requestId} - ${String(body.message)}`,
    );

    response.status(status).json({
      status: false,
      statusCode: status,
      code: exception.errorCode,
      message: body.message,
      request_id: requestId,
      details: body.details || {},
      error: exception.name,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
    });
  }
}
