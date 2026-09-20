import { ProviderAccountErrorCodes } from '../../../provider/account/errors/provider-account-error-codes';
import { ProviderAccountRepository } from '../../../provider/account/repositories/provider-account.repository';
import { ProviderAccountService } from '../../../provider/account/services/provider-account.service';
import { ProviderAccountCommandService } from '../../../provider/account/services/provider-account-command.service';
import { CustomerAccountService } from '../../../customer/account/services/customer-account.service';
import type { SafeCustomerAccount } from '../../../customer/account/types/customer-account.type';
import type { ProviderAccountResponse } from '../../../provider/account/dto/provider-account.response';
import { ProviderRegistrationAdministrationService } from './provider-registration-administration.service';

type CustomerAccountServiceMock = {
  findById: jest.MockedFunction<CustomerAccountService['findById']>;
};

type ProviderAccountRepositoryMock = {
  findPendingForReview: jest.MockedFunction<
    ProviderAccountRepository['findPendingForReview']
  >;
  findPendingByIdForReview: jest.MockedFunction<
    ProviderAccountRepository['findPendingByIdForReview']
  >;
};

type ProviderAccountServiceMock = {
  getCurrent: jest.MockedFunction<ProviderAccountService['getCurrent']>;
};

type ProviderAccountCommandServiceMock = {
  approve: jest.MockedFunction<ProviderAccountCommandService['approve']>;
};

describe('ProviderRegistrationAdministrationService', () => {
  let service: ProviderRegistrationAdministrationService;
  let customerAccountService: CustomerAccountServiceMock;
  let providerAccountRepository: ProviderAccountRepositoryMock;
  let providerAccountService: ProviderAccountServiceMock;
  let providerAccountCommandService: ProviderAccountCommandServiceMock;

  const ownerCustomerId = 'customer-1';
  const approvedProviderId = 'provider-2';
  const providerAccount = {
    id: approvedProviderId,
    displayName: 'Approved Agency',
    verificationStatus: 'VERIFIED',
  } as ProviderAccountResponse;

  beforeEach(() => {
    customerAccountService = { findById: jest.fn() };
    providerAccountRepository = {
      findPendingForReview: jest.fn(),
      findPendingByIdForReview: jest.fn(),
    };
    providerAccountService = { getCurrent: jest.fn() };
    providerAccountCommandService = { approve: jest.fn() };

    service = new ProviderRegistrationAdministrationService(
      customerAccountService as unknown as CustomerAccountService,
      providerAccountRepository as unknown as ProviderAccountRepository,
      providerAccountService as unknown as ProviderAccountService,
      providerAccountCommandService as unknown as ProviderAccountCommandService,
    );
  });

  describe('approve', () => {
    it('reloads the canonical provider by the exact approved id', async () => {
      providerAccountCommandService.approve.mockResolvedValue({
        providerId: approvedProviderId,
        ownerCustomerId,
      });
      customerAccountService.findById.mockResolvedValue({
        id: ownerCustomerId,
      } as SafeCustomerAccount);
      providerAccountService.getCurrent.mockResolvedValue(providerAccount);

      await expect(service.approve(approvedProviderId)).resolves.toEqual({
        customerId: ownerCustomerId,
        role: 'customer',
        providerAccount,
      });
      expect(providerAccountCommandService.approve).toHaveBeenCalledWith(
        approvedProviderId,
      );
      expect(providerAccountService.getCurrent).toHaveBeenCalledWith(
        ownerCustomerId,
        approvedProviderId,
      );
    });

    it('never resolves provider context without the approved provider id', async () => {
      providerAccountCommandService.approve.mockResolvedValue({
        providerId: approvedProviderId,
        ownerCustomerId,
      });
      customerAccountService.findById.mockResolvedValue({
        id: ownerCustomerId,
      } as SafeCustomerAccount);
      providerAccountService.getCurrent.mockResolvedValue(providerAccount);

      await service.approve(approvedProviderId);

      expect(providerAccountService.getCurrent).not.toHaveBeenCalledWith(
        ownerCustomerId,
      );
      expect(providerAccountService.getCurrent).toHaveBeenCalledTimes(1);
    });

    it('propagates the command failure without reloading anything', async () => {
      providerAccountCommandService.approve.mockRejectedValue(
        new Error('approval failed'),
      );

      await expect(service.approve(approvedProviderId)).rejects.toThrow(
        'approval failed',
      );
      expect(customerAccountService.findById).not.toHaveBeenCalled();
      expect(providerAccountService.getCurrent).not.toHaveBeenCalled();
    });
  });

  describe('findPendingById', () => {
    it('throws PROVIDER_ACCOUNT_NOT_FOUND when the pending account is missing', async () => {
      providerAccountRepository.findPendingByIdForReview.mockResolvedValue(
        null,
      );

      await expect(
        service.findPendingById(approvedProviderId),
      ).rejects.toMatchObject({
        errorCode: ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND.code,
      });
    });
  });
});
