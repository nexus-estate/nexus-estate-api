import type { NextFunction, Response } from 'express';

import { AuthenticationMiddleware } from './authentication.middleware';
import type { RequestWithToken } from './authentication.middleware';

describe('AuthenticationMiddleware', () => {
  it.each([
    ['Bearer access-token', 'access-token'],
    [undefined, undefined],
    ['', undefined],
    ['Basic credentials', undefined],
    ['Bearer', undefined],
    ['Bearer ', undefined],
    ['Bearer token extra', undefined],
  ])(
    'extracts only a complete bearer token from %s',
    (authorization, expected) => {
      const request = { headers: { authorization } } as RequestWithToken;
      const next = jest.fn() as NextFunction;

      new AuthenticationMiddleware().use(request, {} as Response, next);

      expect(request.accessToken).toBe(expected);
      expect(request.user).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    },
  );
});
