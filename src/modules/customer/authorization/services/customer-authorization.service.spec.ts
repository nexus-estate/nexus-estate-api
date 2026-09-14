import { CustomerAuthorizationService } from './customer-authorization.service';

describe('CustomerAuthorizationService', () => {
  it('resolves only active Marketplace role mappings and a version fingerprint', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'role-1', code: 'TRUSTED_BUYER', name: 'Trusted buyer' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'permission-1',
          code: 'favorite:create',
          name: 'Create favorite',
          category: 'Favorites',
        },
      ])
      .mockResolvedValueOnce([{ version: '2026-09-13T00:00:00.000Z' }]);
    const service = new CustomerAuthorizationService({ query } as never);

    await expect(service.effective('customer-1')).resolves.toEqual({
      platform: 'MARKETPLACE',
      roles: [{ id: 'role-1', code: 'TRUSTED_BUYER', name: 'Trusted buyer' }],
      permissions: [
        {
          id: 'permission-1',
          code: 'favorite:create',
          name: 'Create favorite',
          category: 'Favorites',
        },
      ],
      authorizationVersion: '2026-09-13T00:00:00.000Z',
    });
    const calls = query.mock.calls as unknown as Array<[string]>;
    expect(calls[0][0]).toContain("role.status = 'ACTIVE'");
  });
});
