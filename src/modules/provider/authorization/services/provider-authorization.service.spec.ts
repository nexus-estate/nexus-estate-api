import { ProviderAuthorizationService } from './provider-authorization.service';

describe('ProviderAuthorizationService', () => {
  it('returns no effective permissions for a customer without membership', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new ProviderAuthorizationService({ query } as never);

    await expect(service.effective('customer-1')).resolves.toMatchObject({
      platform: 'PROVIDER',
      providerId: null,
      membershipId: null,
      roles: [],
      permissions: [],
    });
  });

  it('resolves active membership roles, permissions, and provider state', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          membership_id: 'membership-1',
          provider_id: 'provider-1',
          membership_status: 'ACTIVE',
          provider_status: 'ACTIVE',
          verification_status: 'VERIFIED',
          display_name: 'Provider One',
        },
      ])
      .mockResolvedValueOnce([{ id: 'role-1', code: 'OWNER', name: 'Owner' }])
      .mockResolvedValueOnce([
        {
          id: 'permission-1',
          code: 'provider-account:update',
          name: 'Update account',
          category: 'Provider Account',
        },
      ])
      .mockResolvedValueOnce([{ version: 'v1' }]);
    const service = new ProviderAuthorizationService({ query } as never);

    await expect(service.effective('customer-1')).resolves.toMatchObject({
      providerId: 'provider-1',
      membershipId: 'membership-1',
      roles: [{ code: 'OWNER' }],
      permissions: [{ code: 'provider-account:update' }],
      providerStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      authorizationVersion: 'v1',
    });
  });

  it('does not grant permissions to a suspended membership', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          membership_id: 'membership-1',
          provider_id: 'provider-1',
          membership_status: 'SUSPENDED',
          provider_status: 'ACTIVE',
          verification_status: 'VERIFIED',
          display_name: 'Provider One',
        },
      ])
      .mockResolvedValueOnce([{ version: 'v2' }]);
    const service = new ProviderAuthorizationService({ query } as never);

    await expect(service.effective('customer-1')).resolves.toMatchObject({
      membershipStatus: 'SUSPENDED',
      roles: [],
      permissions: [],
    });
  });
});
