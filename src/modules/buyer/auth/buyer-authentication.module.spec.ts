import { BuyerAuthenticationModule } from './buyer-authentication.module';

describe('BuyerAuthenticationModule', () => {
  it('should register the authentication providers', () => {
    const providers = Reflect.getMetadata(
      'providers',
      BuyerAuthenticationModule,
    ) as Array<{ name: string }> | undefined;
    const providerNames = providers?.map((provider) => provider.name);

    expect(providerNames).toEqual(
      expect.arrayContaining([
        'BuyerAuthenticationService',
        'BuyerJwtStrategy',
        'BuyerJwtAuthGuard',
      ]),
    );
  });
});
