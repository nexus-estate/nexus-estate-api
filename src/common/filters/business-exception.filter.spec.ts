import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

import { ErrorCodes } from '../../utils/constants/error.constant';
import { BusinessException } from '../exceptions/business.exception';
import { BusinessExceptionFilter } from './business-exception.filter';

describe('BusinessExceptionFilter', () => {
  it('returns the standardized business error response', () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const request = {
      originalUrl: '/api/v1/users/missing-id',
      url: '/users/missing-id',
    } as Request;
    const response = { status, json } as unknown as Response;
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ArgumentsHost;
    const exception = new BusinessException(
      ErrorCodes.USER_NOT_FOUND,
      'missing-id',
    );

    new BusinessExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(ErrorCodes.USER_NOT_FOUND.httpStatus);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: false,
        statusCode: ErrorCodes.USER_NOT_FOUND.httpStatus,
        code: ErrorCodes.USER_NOT_FOUND.code,
        path: request.originalUrl,
      }),
    );
  });
});
