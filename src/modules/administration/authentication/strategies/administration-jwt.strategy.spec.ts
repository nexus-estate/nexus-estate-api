import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import type { RequestWithToken } from '../../../../common/middleware/authentication.middleware';
import type { JwtPayload } from '../../../../common/security/auth.types';
import { AdministrationAccountRepository } from '../repositories/administration-account.repository';
import { AdministrationErrorCodes } from '../errors/administration-error-codes';
import { AdministrationJwtStrategy } from './administration-jwt.strategy';

describe('AdministrationJwtStrategy', () => {
  let strategy: AdministrationJwtStrategy;
  const secret = 'administration-strategy-test-secret';
  const account = {
    id: 'administration-id',
    email: 'administration@nexus.test',
    isActive: true,
  };
  const findByIdForAuthentication = jest.fn();
  const payload: JwtPayload = {
    sub: account.id,
    realm: 'administration',
    tokenType: 'access',
    sessionId: 'session-id',
  };

  beforeEach(async () => {
    findByIdForAuthentication.mockReset().mockResolvedValue(account);
    const module = await Test.createTestingModule({
      providers: [
        AdministrationJwtStrategy,
        {
          provide: AdministrationAccountRepository,
          useValue: { findByIdForAuthentication },
        },
        {
          provide: ConfigService,
          useValue: new ConfigService({ ADMIN_JWT_ACCESS_SECRET: secret }),
        },
      ],
    }).compile();
    strategy = module.get(AdministrationJwtStrategy);
  });

  it('authenticates req.accessToken even when the header contains a different token', async () => {
    const result = new Promise<unknown>((resolve, reject) => {
      strategy.success = resolve;
      strategy.fail = () => reject(new Error('Authentication failed'));
      strategy.error = reject;
    });
    strategy.authenticate({
      accessToken: new JwtService().sign(payload, { secret }),
      headers: { authorization: 'Bearer invalid-header-token' },
    } as RequestWithToken);

    await expect(result).resolves.toEqual({
      id: account.id,
      email: account.email,
      realm: 'administration',
    });
    expect(findByIdForAuthentication).toHaveBeenCalledWith(account.id);
  });

  it('does not fall back to the header when req.accessToken is absent', () => {
    const fail = jest.fn();
    strategy.fail = fail;
    strategy.authenticate({
      headers: {
        authorization: `Bearer ${new JwtService().sign(payload, { secret })}`,
      },
    } as RequestWithToken);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(findByIdForAuthentication).not.toHaveBeenCalled();
  });

  it.each<Partial<JwtPayload>>([
    { realm: 'customer' },
    { realm: undefined },
    { tokenType: 'refresh' },
    { tokenType: undefined },
    { sessionId: undefined },
    { sessionId: '' },
  ])(
    'rejects invalid claims before resolving an account: %j',
    async (claims) => {
      await expect(
        strategy.validate({ ...payload, ...claims }),
      ).rejects.toMatchObject({
        errorCode: AdministrationErrorCodes.TOKEN_INVALID.code,
      });
      expect(findByIdForAuthentication).not.toHaveBeenCalled();
    },
  );

  it.each([
    [null, AdministrationErrorCodes.ACCOUNT_NOT_FOUND.code],
    [
      { ...account, isActive: false },
      AdministrationErrorCodes.ACCOUNT_INACTIVE.code,
    ],
  ])(
    'rejects missing or inactive administrators: %j',
    async (current, code) => {
      findByIdForAuthentication.mockResolvedValue(current);
      await expect(strategy.validate(payload)).rejects.toMatchObject({
        errorCode: code,
      });
    },
  );
});
