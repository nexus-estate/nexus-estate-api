import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { ProviderAccountPolicy as ProviderAccountPolicy } from '../helpers/provider-account.policy';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';
import { CurrentProviderContextValue as CurrentProviderContextValue } from '../services/current-provider-context.service';

describe('ProviderAccountPolicy', () => {
  const policy = new ProviderAccountPolicy();
  const context: CurrentProviderContextValue = {
    customerId: '10000000-0000-4000-8000-000000000001',
    providerId: '20000000-0000-4000-8000-000000000001',
    providerType: ProviderType.INDIVIDUAL,
    providerStatus: ProviderStatus.ACTIVE,
    verificationStatus: ProviderVerificationStatus.UNVERIFIED,
  };

  it('allows active providers to perform supply mutations', () => {
    expect(() => policy.requireActiveProvider(context)).not.toThrow();
  });

  it('blocks suspended providers', () => {
    let error: unknown;
    try {
      policy.requireActiveProvider({
        ...context,
        providerStatus: ProviderStatus.SUSPENDED,
      });
    } catch (candidate: unknown) {
      error = candidate;
    }
    expect(error).toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_SUSPENDED.code,
    });
  });

  it('requires the current provider to own a resource', () => {
    let error: unknown;
    try {
      policy.requireProviderOwnership(
        context,
        '20000000-0000-4000-8000-000000000002',
      );
    } catch (candidate: unknown) {
      error = candidate;
    }
    expect(error).toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
    });
  });
});
