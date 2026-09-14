import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { ProviderAccountPolicy } from './provider-account.policy';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';
import { CurrentProviderContextValue } from '../services/current-provider-context.service';

describe('ProviderAccountPolicy', () => {
  const policy = new ProviderAccountPolicy();
  const context: CurrentProviderContextValue = {
    customerId: '10000000-0000-4000-8000-000000000001',
    providerId: '20000000-0000-4000-8000-000000000001',
    providerType: ProviderType.INDIVIDUAL,
    providerStatus: ProviderStatus.ACTIVE,
    verificationStatus: ProviderVerificationStatus.VERIFIED,
  };

  const expectPolicyError = (callback: () => void, errorCode: string): void => {
    let thrown: unknown;
    try {
      callback();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ errorCode });
  };

  it('allows active verified providers to perform supply mutations', () => {
    expect(() => policy.requireActiveProvider(context)).not.toThrow();
  });

  it('blocks suspended providers', () => {
    expectPolicyError(
      () =>
        policy.requireActiveProvider({
          ...context,
          providerStatus: ProviderStatus.SUSPENDED,
        }),
      ProviderAccountErrorCodes.PROVIDER_ACCOUNT_SUSPENDED.code,
    );
  });

  it.each([
    ProviderVerificationStatus.UNVERIFIED,
    ProviderVerificationStatus.PENDING,
    ProviderVerificationStatus.REJECTED,
  ])('blocks %s providers from supply mutations', (verificationStatus) => {
    expectPolicyError(
      () => policy.requireActiveProvider({ ...context, verificationStatus }),
      ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_VERIFIED.code,
    );
  });

  it('requires the current provider to own a resource', () => {
    expectPolicyError(
      () =>
        policy.requireProviderOwnership(
          context,
          '20000000-0000-4000-8000-000000000002',
        ),
      ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
    );
  });
});
