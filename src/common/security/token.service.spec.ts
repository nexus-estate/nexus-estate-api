import type { JwtService } from '@nestjs/jwt';

import { TokenService } from './token.service';

describe('TokenService', () => {
  it('delegates access-token signing to JwtService', async () => {
    const signAsync = jest.fn().mockResolvedValue('access-token');
    const jwtService = {
      signAsync,
      verifyAsync: jest.fn(),
    } as unknown as JwtService;
    const service = new TokenService(jwtService);

    await expect(
      service.signAccessToken(
        { sub: 'customer-id', type: 'access', aud: 'customer' },
        '15m',
      ),
    ).resolves.toBe('access-token');
    expect(signAsync).toHaveBeenCalledWith(
      { sub: 'customer-id', type: 'access', aud: 'customer' },
      { expiresIn: '15m' },
    );
  });

  it('delegates token verification to JwtService', async () => {
    const verifyAsync = jest.fn().mockResolvedValue({ sub: 'customer-id' });
    const jwtService = {
      signAsync: jest.fn(),
      verifyAsync,
    } as unknown as JwtService;
    const service = new TokenService(jwtService);

    await expect(service.verifyToken('token')).resolves.toEqual({
      sub: 'customer-id',
    });
    expect(verifyAsync).toHaveBeenCalledWith('token');
  });
});
