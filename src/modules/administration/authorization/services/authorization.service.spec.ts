import { AuthorizationPlatform } from '../enums/authorization-platform.enum';
import { AuthorizationService } from './authorization.service';

describe('AuthorizationService', () => {
  it('creates independent immutable scopes for each platform', async () => {
    const list = jest.fn().mockResolvedValue({ items: [], meta: {} });
    const service = new AuthorizationService(
      {
        resolve: (platform: AuthorizationPlatform) =>
          Object.freeze({
            platform,
            config: {},
          }),
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
    expect(provider.context).not.toBe(marketplace.context);
    expect(list).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ platform: AuthorizationPlatform.PROVIDER }),
      {},
    );
    expect(list).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ platform: AuthorizationPlatform.MARKETPLACE }),
      {},
    );
  });
});
