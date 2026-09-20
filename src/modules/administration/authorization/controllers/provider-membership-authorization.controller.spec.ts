import { ProviderMembershipAuthorizationController } from './provider-membership-authorization.controller';

describe('ProviderMembershipAuthorizationController', () => {
  it('delegates provider member lookup with the provider scope', async () => {
    const list = jest.fn().mockResolvedValue({ items: [] });
    const controller = new ProviderMembershipAuthorizationController({
      list,
    } as never);
    const query = { page: 1, limit: 20 };

    await expect(controller.members('provider-1', query)).resolves.toEqual({
      items: [],
    });
    expect(list).toHaveBeenCalledWith('provider-1', query);
  });
});
