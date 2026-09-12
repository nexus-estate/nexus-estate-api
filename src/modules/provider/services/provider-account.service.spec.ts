import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { CreateProviderAccountDto, UpdateProviderAccountDto } from '../dto';
import { ProviderAccount as ProviderAccount } from '../models/provider-account.entity';
import { CurrentProviderContext as CurrentProviderContext } from '../services/current-provider-context.service';
import { ProviderAccountPolicy as ProviderAccountPolicy } from '../helpers/provider-account.policy';
import { ProviderAccountRepository as ProviderAccountRepository } from '../repositories/provider-account.repository';
import { ProviderAccountService as ProviderAccountService } from '../services/provider-account.service';
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
  existsByOwnerCustomerId: jest.MockedFunction<
    ProviderAccountRepository['existsByOwnerCustomerId']
  >;
  create: jest.MockedFunction<ProviderAccountRepository['create']>;
  update: jest.MockedFunction<ProviderAccountRepository['update']>;
};

describe('ProviderAccountService', () => {
  let service: ProviderAccountService;
  let repository: RepositoryMock;
  let currentProviderContext: CurrentProviderContext;
  let policy: ProviderAccountPolicy;

  const customerId = '10000000-0000-4000-8000-000000000001';
  const providerId = '20000000-0000-4000-8000-000000000001';
  const account = {
    id: providerId,
    ownerCustomerId: customerId,
    type: ProviderType.INDIVIDUAL,
    displayName: 'Nguyen Van A',
    status: ProviderStatus.ACTIVE,
    verificationStatus: ProviderVerificationStatus.UNVERIFIED,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  } as unknown as ProviderAccount;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByOwnerCustomerId: jest.fn(),
      existsByOwnerCustomerId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    currentProviderContext = new CurrentProviderContext(
      repository as unknown as ProviderAccountRepository,
    );
    policy = new ProviderAccountPolicy();
    service = new ProviderAccountService(
      repository as unknown as ProviderAccountRepository,
      currentProviderContext,
      policy,
    );
  });

  it('creates an account with server-controlled defaults', async () => {
    repository.existsByOwnerCustomerId.mockResolvedValue(false);
    repository.create.mockResolvedValue(account);

    const dto: CreateProviderAccountDto = {
      type: ProviderType.INDIVIDUAL,
      displayName: '  Nguyen Van A  ',
    };

    await expect(
      service.createForCustomer(customerId, dto),
    ).resolves.toMatchObject({
      id: providerId,
      type: ProviderType.INDIVIDUAL,
      displayName: 'Nguyen Van A',
      status: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.UNVERIFIED,
    });
    expect(repository.create).toHaveBeenCalledWith({
      ownerCustomerId: customerId,
      type: ProviderType.INDIVIDUAL,
      displayName: 'Nguyen Van A',
      status: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.UNVERIFIED,
    });
  });

  it('rejects duplicate accounts before persistence', async () => {
    repository.existsByOwnerCustomerId.mockResolvedValue(true);

    await expect(
      service.createForCustomer(customerId, {
        type: ProviderType.BROKER,
        displayName: 'Broker',
      }),
    ).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_ALREADY_EXISTS.code,
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each([
    ['', ProviderAccountErrorCodes.PROVIDER_ACCOUNT_INVALID_DISPLAY_NAME.code],
    [
      '   ',
      ProviderAccountErrorCodes.PROVIDER_ACCOUNT_INVALID_DISPLAY_NAME.code,
    ],
  ])('rejects a blank display name', async (displayName, errorCode) => {
    await expect(
      service.createForCustomer(customerId, {
        type: ProviderType.INDIVIDUAL,
        displayName,
      }),
    ).rejects.toMatchObject({ errorCode });
  });

  it('rejects an invalid provider type', async () => {
    await expect(
      service.createForCustomer(customerId, {
        type: 'NOT_A_provider_TYPE' as ProviderType,
        displayName: 'Provider',
      }),
    ).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_INVALID_TYPE.code,
    });
  });

  it('gets the current account without auto-creating it', async () => {
    repository.findByOwnerCustomerId.mockResolvedValue(account);
    repository.findById.mockResolvedValue(account);

    await expect(service.getCurrent(customerId)).resolves.toMatchObject({
      id: providerId,
    });
    expect(repository.create).not.toHaveBeenCalled();
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
        status: ProviderStatus.ACTIVE,
        verificationStatus: ProviderVerificationStatus.UNVERIFIED,
      },
    );
    expect(repository.update).toHaveBeenCalledWith(providerId, {
      displayName: 'Updated Name',
    });
  });

  it('resolves a reusable current provider context', async () => {
    repository.findByOwnerCustomerId.mockResolvedValue(account);

    await expect(service.resolveCurrentProvider(customerId)).resolves.toEqual({
      customerId,
      providerId,
      providerType: ProviderType.INDIVIDUAL,
      providerStatus: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.UNVERIFIED,
    });
  });
});
