import { QueryFailedError } from 'typeorm';

import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { CreateProviderAccountDto } from '../dto/index';
import { ProviderAccount } from '../entities/provider-account.entity';
import { ProviderAccountRepository } from '../repositories/provider-account.repository';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';
import { ProviderAuthorizationService } from '../../authorization/services/provider-authorization.service';
import { ProviderAccountCommandService } from './provider-account-command.service';

describe('ProviderAccountCommandService', () => {
  let service: ProviderAccountCommandService;
  let repository: {
    existsByOwnerCustomerId: jest.MockedFunction<
      ProviderAccountRepository['existsByOwnerCustomerId']
    >;
  };
  let transactionRepository: { create: jest.Mock; save: jest.Mock };
  let ensureOwnerMembership: jest.Mock;

  const customerId = '10000000-0000-4000-8000-000000000001';
  const providerId = '20000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    repository = { existsByOwnerCustomerId: jest.fn() };
    transactionRepository = { create: jest.fn(), save: jest.fn() };
    transactionRepository.create.mockImplementation(
      (data: unknown) => data as ProviderAccount,
    );
    transactionRepository.save.mockResolvedValue({ id: providerId });
    ensureOwnerMembership = jest.fn();
    const dataSource = {
      transaction: jest.fn((callback: (manager: unknown) => unknown) =>
        callback({ getRepository: () => transactionRepository }),
      ),
    };
    service = new ProviderAccountCommandService(
      dataSource as never,
      repository as unknown as ProviderAccountRepository,
      { ensureOwnerMembership } as unknown as ProviderAuthorizationService,
    );
  });

  it('creates a pending account with server-controlled defaults and owner membership', async () => {
    repository.existsByOwnerCustomerId.mockResolvedValue(false);
    const dto: CreateProviderAccountDto = {
      type: ProviderType.INDIVIDUAL,
      displayName: '  Nguyen Van A  ',
    };

    await expect(service.createPending(customerId, dto)).resolves.toBe(
      providerId,
    );
    expect(transactionRepository.create).toHaveBeenCalledWith({
      ownerCustomerId: customerId,
      type: ProviderType.INDIVIDUAL,
      displayName: 'Nguyen Van A',
      status: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.PENDING,
    });
    expect(ensureOwnerMembership).toHaveBeenCalledWith(
      expect.anything(),
      providerId,
      customerId,
    );
  });

  it('rejects duplicate accounts before persistence', async () => {
    repository.existsByOwnerCustomerId.mockResolvedValue(true);

    await expect(
      service.createPending(customerId, {
        type: ProviderType.BROKER,
        displayName: 'Broker',
      }),
    ).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_ALREADY_EXISTS.code,
    });
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it.each(['', '   '])('rejects blank display name %p', async (displayName) => {
    repository.existsByOwnerCustomerId.mockResolvedValue(false);

    await expect(
      service.createPending(customerId, {
        type: ProviderType.INDIVIDUAL,
        displayName,
      }),
    ).rejects.toMatchObject({
      errorCode:
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_INVALID_DISPLAY_NAME.code,
    });
  });

  it('rejects an invalid provider type', async () => {
    repository.existsByOwnerCustomerId.mockResolvedValue(false);

    await expect(
      service.createPending(customerId, {
        type: 'NOT_A_PROVIDER_TYPE' as ProviderType,
        displayName: 'Provider',
      }),
    ).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_INVALID_TYPE.code,
    });
  });

  it('translates unique-constraint conflicts to a stable business error', async () => {
    repository.existsByOwnerCustomerId.mockResolvedValue(false);
    transactionRepository.save.mockRejectedValue(
      new QueryFailedError('INSERT', [], {
        code: '23505',
      } as unknown as Error),
    );

    await expect(
      service.createPending(customerId, {
        type: ProviderType.INDIVIDUAL,
        displayName: 'Provider',
      }),
    ).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_ALREADY_EXISTS.code,
    });
  });

  it('approves a pending account and returns its owner', async () => {
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          id: providerId,
          ownerCustomerId: customerId,
          verificationStatus: ProviderVerificationStatus.PENDING,
        })
        .mockResolvedValueOnce({ id: customerId }),
      update: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn((callback: (m: unknown) => unknown) =>
        callback(manager),
      ),
    };
    service = new ProviderAccountCommandService(
      dataSource as never,
      repository as unknown as ProviderAccountRepository,
      { ensureOwnerMembership } as unknown as ProviderAuthorizationService,
    );

    await expect(service.approve(providerId)).resolves.toEqual({
      providerId,
      ownerCustomerId: customerId,
    });
    expect(manager.update).toHaveBeenCalledWith(ProviderAccount, providerId, {
      status: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.VERIFIED,
    });
  });

  it('rejects approval when the account is not pending', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue({
        id: providerId,
        ownerCustomerId: customerId,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      }),
      update: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn((callback: (m: unknown) => unknown) =>
        callback(manager),
      ),
    };
    service = new ProviderAccountCommandService(
      dataSource as never,
      repository as unknown as ProviderAccountRepository,
      { ensureOwnerMembership } as unknown as ProviderAuthorizationService,
    );

    await expect(service.approve(providerId)).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_PENDING.code,
    });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('rejects approval when the account does not exist', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn((callback: (m: unknown) => unknown) =>
        callback(manager),
      ),
    };
    service = new ProviderAccountCommandService(
      dataSource as never,
      repository as unknown as ProviderAccountRepository,
      { ensureOwnerMembership } as unknown as ProviderAuthorizationService,
    );

    await expect(service.approve(providerId)).rejects.toMatchObject({
      errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND.code,
    });
  });
});
