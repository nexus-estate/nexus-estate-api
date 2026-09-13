import { JwtService } from '@nestjs/jwt';
import { RealmTokenService } from './realm-token.service';

describe('RealmTokenService', () => {
  it('uses separate signing keys and emits realm/token type claims', async () => {
    const signAsync = jest.fn().mockResolvedValue('signed-token');
    const verifyAsync = jest.fn().mockResolvedValue({ sub: 'account-id' });
    const jwtService = { signAsync, verifyAsync } as unknown as JwtService;
    const service = new RealmTokenService(jwtService, {
      realm: 'administration',
      accessSecret: 'admin-access',
      refreshSecret: 'admin-refresh',
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
    });

    await service.signAccessToken({ sub: 'account-id' });
    await service.signRefreshToken({ sub: 'account-id' });
    await service.verifyAccessToken('access');
    await service.verifyRefreshToken('refresh');

    expect(signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ realm: 'administration', tokenType: 'access' }),
      expect.objectContaining({ secret: 'admin-access', expiresIn: '15m' }),
    );
    expect(signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        realm: 'administration',
        tokenType: 'refresh',
      }),
      expect.objectContaining({ secret: 'admin-refresh', expiresIn: '7d' }),
    );
    expect(verifyAsync).toHaveBeenNthCalledWith(1, 'access', {
      secret: 'admin-access',
    });
    expect(verifyAsync).toHaveBeenNthCalledWith(2, 'refresh', {
      secret: 'admin-refresh',
    });
  });
});
