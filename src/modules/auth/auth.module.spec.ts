import { AuthModule } from './auth.module';

describe('AuthModule', () => {
  it('should register the authentication providers', () => {
    const providers = Reflect.getMetadata('providers', AuthModule) as
      Array<{ name: string }> | undefined;
    const providerNames = providers?.map((provider) => provider.name);

    expect(providerNames).toEqual(
      expect.arrayContaining([
        'AuthService',
        'LocalAuthGuard',
        'LocalStrategy',
        'JwtStrategy',
      ]),
    );
  });
});
