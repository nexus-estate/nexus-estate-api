import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

import { BuyerAccountErrorCodes } from '../../modules/buyer/account/errors/buyer-account-error-codes';
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
      BuyerAccountErrorCodes.BUYER_ACCOUNT_NOT_FOUND,
      'missing-id',
    );

    new BusinessExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(
      BuyerAccountErrorCodes.BUYER_ACCOUNT_NOT_FOUND.httpStatus,
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: false,
        statusCode: BuyerAccountErrorCodes.BUYER_ACCOUNT_NOT_FOUND.httpStatus,
        code: BuyerAccountErrorCodes.BUYER_ACCOUNT_NOT_FOUND.code,
        path: request.originalUrl,
        message: 'Không tìm thấy tài khoản người mua với mã missing-id.',
      }),
    );
  });
});
