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
    ['Bearer  token', undefined],
    ['Bearer\ttoken', undefined],
    [' Bearer token', undefined],
    ['Bearer token ', undefined],
    ['bearer token', undefined],
    ['Bearer token\nextra', undefined],
    ['Bearer expired.or.invalid-signature', 'expired.or.invalid-signature'],
  ])(
    'extracts only a complete bearer token from %s',
    (authorization, expected) => {
      const request = { headers: { authorization } } as RequestWithToken;
      const next = jest.fn() as NextFunction;

      new AuthenticationMiddleware().use(request, {} as Response, next);

      expect(request.accessToken).toBe(expected);
      expect(Object.hasOwn(request, 'accessToken')).toBe(
        expected !== undefined,
      );
      expect(request.user).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    },
  );
});
