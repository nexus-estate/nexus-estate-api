import type { NextFunction, Request, Response } from 'express';

import {
  REQUEST_ID_HEADER,
  RequestContextMiddleware,
  RequestWithContext,
} from './request-context.middleware';

describe('RequestContextMiddleware', () => {
  it('reuses the incoming request id and exposes it on the response', () => {
    const request = {
      headers: { [REQUEST_ID_HEADER]: 'client-correlation-id' },
    } as unknown as Request;
    const setHeader = jest.fn();
    const next = jest.fn() as NextFunction;

    new RequestContextMiddleware().use(
      request,
      { setHeader } as unknown as Response,
      next,
    );

    expect((request as RequestWithContext).requestId).toBe(
      'client-correlation-id',
    );
    expect(setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      'client-correlation-id',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates and attaches a request id when the client does not provide one', () => {
    const request = { headers: {} } as unknown as Request;
    const setHeader = jest.fn();
    const next = jest.fn() as NextFunction;

    new RequestContextMiddleware().use(
      request,
      { setHeader } as unknown as Response,
      next,
    );

    const requestId = (request as RequestWithContext).requestId;
    expect(requestId).toEqual(expect.any(String));
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
