import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import type { RequestWithToken } from '../../../../common/middleware/authentication.middleware';
import type { JwtPayload } from '../../../../common/security/auth.types';
import { CustomerAccountService } from '../../account/services/customer-account.service';
import { CustomerAuthErrorCodes } from '../errors/customer-auth-error-codes';
import { CustomerJwtStrategy } from './customer-jwt.strategy';

describe('CustomerJwtStrategy', () => {
  let strategy: CustomerJwtStrategy;
  const secret = 'customer-strategy-test-secret';
  const account = {
    id: 'customer-id',
    email: 'customer@nexus.test',
    isActive: true,
  };
  const findById = jest.fn();
  const payload: JwtPayload = {
    sub: account.id,
    realm: 'customer',
    tokenType: 'access',
    sessionId: 'session-id',
  };

  beforeEach(async () => {
    findById.mockReset().mockResolvedValue(account);
    const module = await Test.createTestingModule({
      providers: [
        CustomerJwtStrategy,
        { provide: CustomerAccountService, useValue: { findById } },
        {
          provide: ConfigService,
          useValue: new ConfigService({ CUSTOMER_JWT_ACCESS_SECRET: secret }),
        },
      ],
    }).compile();
    strategy = module.get(CustomerJwtStrategy);
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
      realm: 'customer',
    });
    expect(findById).toHaveBeenCalledWith(account.id);
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
    expect(findById).not.toHaveBeenCalled();
  });

  it.each<Partial<JwtPayload>>([
    { realm: 'administration' },
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
        errorCode: CustomerAuthErrorCodes.TOKEN_INVALID.code,
      });
      expect(findById).not.toHaveBeenCalled();
    },
  );

  it('preserves current account rejection from the account service', async () => {
    const error = new BusinessException(CustomerAuthErrorCodes.TOKEN_INVALID);
    findById.mockRejectedValue(error);
    await expect(strategy.validate(payload)).rejects.toBe(error);
  });
});
