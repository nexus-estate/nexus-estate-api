import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationService } from './authorization.service';

describe('AuthorizationService', () => {
  it('creates independent immutable bound operations for each platform', async () => {
    const list = jest.fn().mockResolvedValue({ items: [], meta: {} });
    const providerContext = Object.freeze({
      platform: AuthorizationPlatform.PROVIDER,
      config: {},
    });
    const marketplaceContext = Object.freeze({
      platform: AuthorizationPlatform.MARKETPLACE,
      config: {},
    });
    const service = new AuthorizationService(
      {
        resolve: (platform: AuthorizationPlatform) =>
          platform === AuthorizationPlatform.PROVIDER
            ? providerContext
            : marketplaceContext,
      } as never,
      { list, get: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const provider = service.for(AuthorizationPlatform.PROVIDER);
    const marketplace = service.for(AuthorizationPlatform.MARKETPLACE);

    await provider.roles.list({} as never);
    await marketplace.roles.list({} as never);

    expect(provider).not.toBe(marketplace);
    expect(Object.isFrozen(provider)).toBe(true);
    expect(Object.isFrozen(provider.roles)).toBe(true);
    expect(providerContext).not.toBe(marketplaceContext);
    expect(providerContext.platform).toBe(AuthorizationPlatform.PROVIDER);
    expect(marketplaceContext.platform).toBe(AuthorizationPlatform.MARKETPLACE);
    expect(list).toHaveBeenNthCalledWith(1, providerContext, {});
    expect(list).toHaveBeenNthCalledWith(2, marketplaceContext, {});
  });
});
