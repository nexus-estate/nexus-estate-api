import { ProviderAuthorizationService } from './provider-authorization.service';
import { ProviderAccountErrorCodes } from '../../account/errors/provider-account-error-codes';
import type { ProviderContext } from '../../account/services/provider-context.resolver';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../../account/enums/account.enums';

const context: ProviderContext = {
  customerId: 'customer-1',
  providerId: 'provider-1',
  providerType: ProviderType.INDIVIDUAL,
  providerStatus: ProviderStatus.ACTIVE,
  verificationStatus: ProviderVerificationStatus.VERIFIED,
  providerDisplayName: 'Provider One',
  membershipId: 'membership-1',
  membershipStatus: 'ACTIVE',
};

describe('ProviderAuthorizationService', () => {
  it('resolves active membership roles, permissions, and provider state', async () => {
    const query = jest
      .fn()
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

    await expect(service.effective(context)).resolves.toMatchObject({
      platform: 'PROVIDER',
      providerId: 'provider-1',
      membershipId: 'membership-1',
      roles: [{ code: 'OWNER' }],
      permissions: [{ code: 'provider-account:update' }],
      providerStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      membershipStatus: 'ACTIVE',
      authorizationVersion: 'v1',
    });
  });

  it('grants no authority to a legacy context without a membership', async () => {
    const query = jest.fn();
    const service = new ProviderAuthorizationService({ query } as never);

    await expect(
      service.effective({
        ...context,
        membershipId: null,
        membershipStatus: null,
      }),
    ).resolves.toMatchObject({
      membershipId: null,
      roles: [],
      permissions: [],
      membershipStatus: null,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('does not grant permissions to a non-active membership', async () => {
    const query = jest.fn();
    const service = new ProviderAuthorizationService({ query } as never);

    await expect(
      service.effective({ ...context, membershipStatus: 'SUSPENDED' }),
    ).resolves.toMatchObject({
      membershipStatus: 'SUSPENDED',
      roles: [],
      permissions: [],
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects requireOwner when the membership lacks the OWNER role', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'role-1', code: 'AGENT', name: 'Agent' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ version: 'v1' }]);
    const service = new ProviderAuthorizationService({ query } as never);

    await expect(service.requireOwner(context)).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
    });
  });

  it('allows requireOwner when the membership holds the OWNER role', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'role-1', code: 'OWNER', name: 'Owner' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ version: 'v1' }]);
    const service = new ProviderAuthorizationService({ query } as never);

    await expect(service.requireOwner(context)).resolves.toBeUndefined();
  });
});
