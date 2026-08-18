import type { JwtService } from '@nestjs/jwt';

import { TokenHelper } from '../token.helper';

describe('TokenHelper', () => {
  const originalAccessExpiry = process.env.JWT_ACCESS_EXPIRES_IN;
  const originalRefreshExpiry = process.env.JWT_REFRESH_EXPIRES_IN;
  let signAsync: jest.Mock;
  let verifyAsync: jest.Mock;
  let jwtService: JwtService;

  beforeEach(() => {
    signAsync = jest.fn();
    verifyAsync = jest.fn();
    jwtService = { signAsync, verifyAsync } as unknown as JwtService;
    delete process.env.JWT_ACCESS_EXPIRES_IN;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
  });

  afterAll(() => {
    if (originalAccessExpiry === undefined) {
      delete process.env.JWT_ACCESS_EXPIRES_IN;
    } else {
      process.env.JWT_ACCESS_EXPIRES_IN = originalAccessExpiry;
    }

    if (originalRefreshExpiry === undefined) {
      delete process.env.JWT_REFRESH_EXPIRES_IN;
    } else {
      process.env.JWT_REFRESH_EXPIRES_IN = originalRefreshExpiry;
    }
  });

  it('generates an access token with the default expiry', async () => {
    signAsync.mockResolvedValue('access-token');

    await expect(
      TokenHelper.generateAccessToken(jwtService, 'user-id'),
    ).resolves.toBe('access-token');
    expect(signAsync).toHaveBeenCalledWith(
      { sub: 'user-id' },
      { expiresIn: '15m' },
    );
  });

  it('generates a refresh token with the configured expiry', async () => {
    process.env.JWT_REFRESH_EXPIRES_IN = '30d';
    signAsync.mockResolvedValue('refresh-token');

    await expect(
      TokenHelper.generateRefreshToken(jwtService, 'user-id'),
    ).resolves.toBe('refresh-token');
    expect(signAsync).toHaveBeenCalledWith(
      { sub: 'user-id' },
      { expiresIn: '30d' },
    );
  });

  it('returns only the subject from a verified token', async () => {
    verifyAsync.mockResolvedValue({ sub: 'user-id', ignored: true });

    await expect(
      TokenHelper.verifyToken(jwtService, 'signed-token'),
    ).resolves.toEqual({ sub: 'user-id' });
    expect(verifyAsync).toHaveBeenCalledWith('signed-token');
  });
});
