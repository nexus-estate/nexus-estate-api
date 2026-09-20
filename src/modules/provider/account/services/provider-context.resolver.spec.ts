import { QueryFailedError } from 'typeorm';

import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';
import { ProviderAccountRepository } from '../repositories/provider-account.repository';
import { ProviderContextResolver } from './provider-context.resolver';

describe('ProviderContextResolver', () => {
  const customerId = '10000000-0000-4000-8000-000000000001';
  const providerId = '20000000-0000-4000-8000-000000000001';
  const otherProviderId = '20000000-0000-4000-8000-000000000002';

  const membershipRow = (overrides: Record<string, unknown> = {}) => ({
    membership_id: '30000000-0000-4000-8000-000000000001',
    membership_status: 'ACTIVE',
    provider_id: providerId,
    provider_type: ProviderType.AGENCY,
    provider_status: ProviderStatus.ACTIVE,
    verification_status: ProviderVerificationStatus.VERIFIED,
    display_name: 'Riverside Agency',
    ...overrides,
  });

  it('selects the exact active membership requested by provider context', async () => {
    const query = jest.fn().mockResolvedValue([membershipRow()]);
    const resolver = new ProviderContextResolver(
      {} as ProviderAccountRepository,
      { query } as never,
    );

    await expect(
      resolver.resolve(customerId, providerId),
    ).resolves.toMatchObject({
      customerId,
      providerId,
      providerType: ProviderType.AGENCY,
      providerStatus: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.VERIFIED,
      providerDisplayName: 'Riverside Agency',
      membershipId: '30000000-0000-4000-8000-000000000001',
      membershipStatus: 'ACTIVE',
    });
    const firstCall = query.mock.calls[0] as unknown as unknown[];
    expect(firstCall[1]).toEqual([customerId, providerId]);
  });

  it('accepts a single active membership without an explicit provider id', async () => {
    const query = jest.fn().mockResolvedValue([membershipRow()]);
    const resolver = new ProviderContextResolver(
      {} as ProviderAccountRepository,
      { query } as never,
    );

    await expect(resolver.resolve(customerId)).resolves.toMatchObject({
      providerId,
      membershipStatus: 'ACTIVE',
    });
  });

  it('requires an explicit provider context when active memberships are ambiguous', async () => {
    const query = jest.fn().mockResolvedValue([
      membershipRow(),
      membershipRow({
        membership_id: '30000000-0000-4000-8000-000000000002',
        provider_id: otherProviderId,
      }),
    ]);
    const resolver = new ProviderContextResolver(
      {} as ProviderAccountRepository,
      { query } as never,
    );

    await expect(resolver.resolve(customerId)).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_CONTEXT_REQUIRED.code,
    });
  });

  it('rejects a provider the customer does not own', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const resolver = new ProviderContextResolver(
      {} as ProviderAccountRepository,
      { query } as never,
    );

    await expect(
      resolver.resolve(customerId, providerId),
    ).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
    });
  });

  it('rejects an invalid provider identifier before querying memberships', async () => {
    const query = jest.fn();
    const resolver = new ProviderContextResolver(
      {} as ProviderAccountRepository,
      { query } as never,
    );

    await expect(
      resolver.resolve(customerId, 'not-a-uuid'),
    ).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('treats an inactive or deleted membership as no context', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const resolver = new ProviderContextResolver(
      {} as ProviderAccountRepository,
      { query } as never,
    );

    await expect(resolver.resolve(customerId)).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND.code,
    });
    await expect(
      resolver.resolve(customerId, providerId),
    ).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
    });
  });

  it('does not fall back to an arbitrary account when membership data is empty', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const repository = {
      findByOwnerCustomerId: jest.fn(),
    };
    const resolver = new ProviderContextResolver(
      repository as unknown as ProviderAccountRepository,
      { query } as never,
    );

    await expect(resolver.resolve(customerId)).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND.code,
    });
    expect(repository.findByOwnerCustomerId).not.toHaveBeenCalled();
  });

  it('uses the legacy owner-account fallback only when the membership schema is unavailable', async () => {
    const query = jest.fn().mockRejectedValue(
      new QueryFailedError('SELECT membership', [], {
        code: '42P01',
      } as unknown as Error),
    );
    const repository = {
      findByOwnerCustomerId: jest.fn().mockResolvedValue({
        id: providerId,
        ownerCustomerId: customerId,
        type: ProviderType.INDIVIDUAL,
        displayName: 'Legacy Owner',
        status: ProviderStatus.ACTIVE,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      }),
    };
    const resolver = new ProviderContextResolver(
      repository as unknown as ProviderAccountRepository,
      { query } as never,
    );

    await expect(resolver.resolve(customerId)).resolves.toEqual({
      customerId,
      providerId,
      providerType: ProviderType.INDIVIDUAL,
      providerStatus: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.VERIFIED,
      providerDisplayName: 'Legacy Owner',
      membershipId: null,
      membershipStatus: null,
    });
  });

  it('rejects an unmatched provider on the legacy fallback path', async () => {
    const query = jest.fn().mockRejectedValue(
      new QueryFailedError('SELECT membership', [], {
        code: '42P01',
      } as unknown as Error),
    );
    const repository = {
      findByOwnerCustomerId: jest.fn().mockResolvedValue({
        id: providerId,
        ownerCustomerId: customerId,
        type: ProviderType.INDIVIDUAL,
        displayName: 'Legacy Owner',
        status: ProviderStatus.ACTIVE,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      }),
    };
    const resolver = new ProviderContextResolver(
      repository as unknown as ProviderAccountRepository,
      { query } as never,
    );

    await expect(
      resolver.resolve(customerId, otherProviderId),
    ).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
    });
  });
});
