import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { UpdateProviderAccountDto } from '../dto/index';
import { ProviderAccount } from '../entities/provider-account.entity';
import { ProviderContextResolver } from './provider-context.resolver';
import { ProviderAccountRepository } from '../repositories/provider-account.repository';
import { ProviderAccountService } from './provider-account.service';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';

type RepositoryMock = {
  findById: jest.MockedFunction<ProviderAccountRepository['findById']>;
  findByOwnerCustomerId: jest.MockedFunction<
    ProviderAccountRepository['findByOwnerCustomerId']
  >;
  update: jest.MockedFunction<ProviderAccountRepository['update']>;
};

describe('ProviderAccountService', () => {
  let service: ProviderAccountService;
  let repository: RepositoryMock;

  const customerId = '10000000-0000-4000-8000-000000000001';
  const providerId = '20000000-0000-4000-8000-000000000001';
  const account = {
    id: providerId,
    ownerCustomerId: customerId,
    type: ProviderType.INDIVIDUAL,
    displayName: 'Nguyen Van A',
    status: ProviderStatus.ACTIVE,
    verificationStatus: ProviderVerificationStatus.PENDING,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  } as unknown as ProviderAccount;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByOwnerCustomerId: jest.fn(),
      update: jest.fn(),
    };
    const providerContextResolver = new ProviderContextResolver(
      repository as unknown as ProviderAccountRepository,
    );
    service = new ProviderAccountService(
      repository as unknown as ProviderAccountRepository,
      providerContextResolver,
    );
  });

  it('gets the current account without creating one', async () => {
    repository.findByOwnerCustomerId.mockResolvedValue(account);
    repository.findById.mockResolvedValue(account);

    await expect(service.getCurrent(customerId)).resolves.toMatchObject({
      id: providerId,
    });
  });

  it('returns not found when the current account is missing', async () => {
    repository.findByOwnerCustomerId.mockResolvedValue(null);

    await expect(service.getCurrent(customerId)).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND.code,
    });
  });

  it('updates only the display name', async () => {
    repository.findByOwnerCustomerId.mockResolvedValue(account);
    repository.findById.mockResolvedValue(account);
    repository.update.mockResolvedValue({
      ...account,
      displayName: 'Updated Name',
    });
    const dto: UpdateProviderAccountDto = { displayName: ' Updated Name ' };

    await expect(service.updateCurrent(customerId, dto)).resolves.toMatchObject(
      {
        displayName: 'Updated Name',
        verificationStatus: ProviderVerificationStatus.PENDING,
      },
    );
    expect(repository.update).toHaveBeenCalledWith(providerId, {
      displayName: 'Updated Name',
    });
  });
});
