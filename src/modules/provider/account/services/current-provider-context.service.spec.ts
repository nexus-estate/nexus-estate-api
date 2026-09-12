import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';
import { ProviderAccountRepository } from '../repositories/provider-account.repository';
import { CurrentProviderContext } from './current-provider-context.service';

describe('CurrentProviderContext', () => {
  const customerId = '10000000-0000-4000-8000-000000000001';
  const providerId = '20000000-0000-4000-8000-000000000001';

  it('returns the provider identity and capability state for a customer', async () => {
    const repository = {
      findByOwnerCustomerId: jest.fn().mockResolvedValue({
        id: providerId,
        ownerCustomerId: customerId,
        type: ProviderType.AGENCY,
        status: ProviderStatus.ACTIVE,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      }),
    };
    const context = new CurrentProviderContext(
      repository as unknown as ProviderAccountRepository,
    );

    await expect(context.resolve(customerId)).resolves.toEqual({
      customerId,
      providerId,
      providerType: ProviderType.AGENCY,
      providerStatus: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.VERIFIED,
    });
  });

  it('rejects customers without a provider account', async () => {
    const repository = {
      findByOwnerCustomerId: jest.fn().mockResolvedValue(null),
    };
    const context = new CurrentProviderContext(
      repository as unknown as ProviderAccountRepository,
    );

    await expect(context.resolve(customerId)).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND.code,
    });
  });
});
