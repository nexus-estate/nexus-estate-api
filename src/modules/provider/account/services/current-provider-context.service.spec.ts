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

  it('requires an explicit provider context when active memberships are ambiguous', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        membership_id: '30000000-0000-4000-8000-000000000001',
        membership_status: 'ACTIVE',
        provider_id: providerId,
        provider_type: ProviderType.AGENCY,
        provider_status: ProviderStatus.ACTIVE,
        verification_status: ProviderVerificationStatus.VERIFIED,
      },
      {
        membership_id: '30000000-0000-4000-8000-000000000002',
        membership_status: 'ACTIVE',
        provider_id: '20000000-0000-4000-8000-000000000002',
        provider_type: ProviderType.INDIVIDUAL,
        provider_status: ProviderStatus.ACTIVE,
        verification_status: ProviderVerificationStatus.VERIFIED,
      },
    ]);
    const context = new CurrentProviderContext(
      {} as ProviderAccountRepository,
      { query } as never,
    );

    await expect(context.resolve(customerId)).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_CONTEXT_REQUIRED.code,
    });
  });

  it('selects the exact active membership requested by provider context', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        membership_id: '30000000-0000-4000-8000-000000000001',
        membership_status: 'ACTIVE',
        provider_id: providerId,
        provider_type: ProviderType.AGENCY,
        provider_status: ProviderStatus.ACTIVE,
        verification_status: ProviderVerificationStatus.VERIFIED,
      },
    ]);
    const context = new CurrentProviderContext(
      {} as ProviderAccountRepository,
      { query } as never,
    );

    await expect(
      context.resolve(customerId, providerId),
    ).resolves.toMatchObject({
      providerId,
      membershipStatus: 'ACTIVE',
    });
    const firstCall = query.mock.calls[0] as unknown as unknown[];
    expect(firstCall[1]).toEqual([customerId, providerId]);
  });

  it('does not fall back to an arbitrary account when membership data is empty', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const repository = {
      findByOwnerCustomerId: jest.fn(),
    };
    const context = new CurrentProviderContext(
      repository as unknown as ProviderAccountRepository,
      { query } as never,
    );

    await expect(context.resolve(customerId)).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND.code,
    });
    expect(repository.findByOwnerCustomerId).not.toHaveBeenCalled();
  });
});
