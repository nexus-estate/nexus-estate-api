import {
  BadRequestException,
  type ArgumentsHost,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { HttpExceptionFilter } from './http-exception.filter';

function createHost() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  const request = {
    originalUrl: '/api/v1/example',
    url: '/example',
  } as Request;
  const response = { status, json } as unknown as Response;
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;

  return { host, json, status };
}

describe('HttpExceptionFilter', () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formats validation message arrays', () => {
    const { host, json, status } = createHost();
    const exception = new BadRequestException({
      message: ['email must be an email', 'name is too short'],
      error: 'Bad Request',
    });

    new HttpExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('UNKNOWN /api/v1/example 400'),
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: false,
        statusCode: 400,
        message: 'email must be an email; name is too short',
        path: '/api/v1/example',
      }),
    );
  });

  it('does not expose unexpected internal error messages', () => {
    const { host, json, status } = createHost();

    new HttpExceptionFilter().catch(
      new Error('database password leaked'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('UNKNOWN /api/v1/example 500'),
      expect.any(String),
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        error: 'InternalServerError',
      }),
    );
  });
});
