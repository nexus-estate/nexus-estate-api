import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { lastValueFrom, of } from 'rxjs';

import { TransformInterceptor } from './transform.interceptor';

function createContext(url: string, contentType?: string): ExecutionContext {
  const request = { url } as Request;
  const response = {
    getHeader: jest.fn().mockReturnValue(contentType),
  } as unknown as Response;

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;
}

describe('TransformInterceptor', () => {
  const data = { id: 'user-id' };
  let next: CallHandler;

  beforeEach(() => {
    next = { handle: jest.fn(() => of(data)) };
  });

  it('wraps JSON responses in the success envelope', async () => {
    const result = await lastValueFrom(
      new TransformInterceptor().intercept(
        createContext('/api/v1/users', 'application/json'),
        next,
      ),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: true,
        data,
        path: '/api/v1/users',
      }),
    );
  });

  it('passes the health endpoint through unchanged', async () => {
    const result = await lastValueFrom(
      new TransformInterceptor().intercept(
        createContext('/healthz?source=probe'),
        next,
      ),
    );

    expect(result).toBe(data);
  });

  it('passes non-JSON responses through unchanged', async () => {
    const result = await lastValueFrom(
      new TransformInterceptor().intercept(
        createContext('/api/v1/media/file', 'image/png'),
        next,
      ),
    );

    expect(result).toBe(data);
  });
});
