import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

import { CustomerAccountErrorCodes } from '../../modules/customer/errors/customer-account-error-codes';
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
      headers: { 'x-lang': 'vi' },
    } as unknown as Request;
    const response = { status, json } as unknown as Response;
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ArgumentsHost;
    const exception = new BusinessException(
      CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_NOT_FOUND,
      'missing-id',
    );

    new BusinessExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(
      CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_NOT_FOUND.httpStatus,
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: false,
        statusCode:
          CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_NOT_FOUND.httpStatus,
        code: CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_NOT_FOUND.code,
        path: request.originalUrl,
        message: 'Không tìm thấy tài khoản người dùng với mã missing-id.',
      }),
    );
  });
});
