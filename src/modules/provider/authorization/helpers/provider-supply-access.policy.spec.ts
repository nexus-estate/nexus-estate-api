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

  const buildPolicy = (requireOwner = jest.fn()) => {
    const accountPolicy = new ProviderAccountPolicy();
    const authorizationService = {
      requireOwner,
    } as unknown as ProviderAuthorizationService;
    return {
      policy: new ProviderSupplyAccessPolicy(
        accountPolicy,
        authorizationService,
      ),
      requireOwner,
    };
  };

  it('allows reads for active verified providers without checking roles', () => {
    const { policy, requireOwner } = buildPolicy();
    expect(() => policy.requireReadAccess(context)).not.toThrow();
    expect(requireOwner).not.toHaveBeenCalled();
  });

  it('requires the OWNER role for writes', async () => {
    const { policy, requireOwner } = buildPolicy();
    await expect(policy.requireWriteAccess(context)).resolves.toBeUndefined();
    expect(requireOwner).toHaveBeenCalledWith(context);
  });

  it('blocks reads for suspended providers before any role check', () => {
    const { policy, requireOwner } = buildPolicy();
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
    expect(requireOwner).not.toHaveBeenCalled();
  });

  it('propagates the authorization owner failure for writes', async () => {
    const requireOwner = jest
      .fn()
      .mockRejectedValue(
        new BusinessException(
          ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
        ),
      );
    const { policy } = buildPolicy(requireOwner);

    await expect(policy.requireWriteAccess(context)).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
    });
  });
});
