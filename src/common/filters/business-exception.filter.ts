import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';
import { localizeBusinessError } from '../i18n/business-error-message';
import { API_LANGUAGE_HEADER, resolveApiLanguage } from '../i18n/language';
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
    const language = resolveApiLanguage(request.headers?.[API_LANGUAGE_HEADER]);
    const message = localizeBusinessError(
      exception.errorDefinition,
      exception.messageArgs,
      language,
    );

    this.logger.warn(
      `Business exception: ${exception.errorCode} lang=${language} request_id=${requestId} - ${message}`,
    );

    if (typeof response.setHeader === 'function') {
      response.setHeader('content-language', language);
    }
    response.status(status).json({
      status: false,
      statusCode: status,
      code: exception.errorCode,
      message,
      request_id: requestId,
      details: body.details || {},
      error: exception.name,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
    });
  }
}
