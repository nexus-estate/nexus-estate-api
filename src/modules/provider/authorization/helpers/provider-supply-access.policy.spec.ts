import { ProviderAccountErrorCodes } from '../../account/errors/provider-account-error-codes';
import { ProviderAccountPolicy } from '../../account/helpers/provider-account.policy';
import type { ProviderContext } from '../../account/services/provider-context.resolver';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../../account/enums/account.enums';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { ProviderAuthorizationService } from '../services/provider-authorization.service';
import { ProviderSupplyAccessPolicy } from './provider-supply-access.policy';

describe('ProviderSupplyAccessPolicy', () => {
  const context: ProviderContext = {
    customerId: '10000000-0000-4000-8000-000000000001',
    providerId: '20000000-0000-4000-8000-000000000001',
    providerType: ProviderType.INDIVIDUAL,
    providerStatus: ProviderStatus.ACTIVE,
    verificationStatus: ProviderVerificationStatus.VERIFIED,
    providerDisplayName: 'Provider',
    membershipId: '30000000-0000-4000-8000-000000000001',
    membershipStatus: 'ACTIVE',
  };

  const buildPolicy = (requirePermission = jest.fn()) => {
    const accountPolicy = new ProviderAccountPolicy();
    const authorizationService = {
      requirePermission,
    } as unknown as ProviderAuthorizationService;
    return {
      policy: new ProviderSupplyAccessPolicy(
        accountPolicy,
        authorizationService,
      ),
      requirePermission,
    };
  };

  it('allows reads for active verified providers without checking roles', () => {
    const { policy, requirePermission } = buildPolicy();
    expect(() => policy.requireReadAccess(context)).not.toThrow();
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it('requires the requested provider permission after lifecycle checks', async () => {
    const { policy, requirePermission } = buildPolicy();
    await expect(
      policy.requirePermission(context, 'property:create'),
    ).resolves.toBeUndefined();
    expect(requirePermission).toHaveBeenCalledWith(context, 'property:create');
  });

  it('blocks reads for suspended providers before any role check', () => {
    const { policy, requirePermission } = buildPolicy();
    let thrown: unknown;
    try {
      policy.requireReadAccess({
        ...context,
        providerStatus: ProviderStatus.SUSPENDED,
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_SUSPENDED.code,
    });
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it('propagates a missing-permission failure', async () => {
    const requirePermission = jest
      .fn()
      .mockRejectedValue(
        new BusinessException(
          ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
        ),
      );
    const { policy } = buildPolicy(requirePermission);

    await expect(
      policy.requirePermission(context, 'property:create'),
    ).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
    });
  });
});
