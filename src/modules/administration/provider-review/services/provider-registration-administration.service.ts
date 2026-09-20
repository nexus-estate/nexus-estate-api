import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CustomerAccountService } from '../../../customer/account/services/customer-account.service';
import { ProviderAccountService } from '../../../provider/account/services/provider-account.service';
import { ProviderAccountCommandService } from '../../../provider/account/services/provider-account-command.service';
import { ProviderAccountRepository } from '../../../provider/account/repositories/provider-account.repository';
import { ProviderAccount } from '../../../provider/account/entities/provider-account.entity';
import { ProviderAccountMapper } from '../../../provider/account/helpers/provider-account.mapper';
import { ProviderAccountErrorCodes } from '../../../provider/account/errors/provider-account-error-codes';
import type { ProviderRegistrationResponse } from '../../../provider/registration/dto/provider-registration.response';
import type { ProviderRegistrationReviewResponse } from '../dto/provider-registration-review.response';

/** Provides administration review and approval operations for provider requests. */
@Injectable()
export class ProviderRegistrationAdministrationService {
  constructor(
    private readonly customerAccountService: CustomerAccountService,
    private readonly providerAccountRepository: ProviderAccountRepository,
    private readonly providerAccountService: ProviderAccountService,
    private readonly providerAccountCommandService: ProviderAccountCommandService,
  ) {}

  /** Lists provider registrations awaiting administrator review. */
  async findPending(): Promise<ProviderRegistrationReviewResponse[]> {
    const accounts =
      await this.providerAccountRepository.findPendingForReview();
    return accounts.map((account) => this.toReviewResponse(account));
  }

  /** Loads one exact pending provider registration for an administrator review screen. */
  async findPendingById(
    accountId: string,
  ): Promise<ProviderRegistrationReviewResponse> {
    const account =
      await this.providerAccountRepository.findPendingByIdForReview(accountId);
    if (!account) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND,
        accountId,
      );
    }
    return this.toReviewResponse(account);
  }

  /** Approves one pending provider account and reloads the canonical response. */
  async approve(accountId: string): Promise<ProviderRegistrationResponse> {
    const { ownerCustomerId } =
      await this.providerAccountCommandService.approve(accountId);

    const customer =
      await this.customerAccountService.findById(ownerCustomerId);
    const providerAccount =
      await this.providerAccountService.getCurrent(ownerCustomerId);
    return {
      customerId: customer.id,
      role: 'customer',
      providerAccount,
    };
  }

  private toReviewResponse(
    account: ProviderAccount,
  ): ProviderRegistrationReviewResponse {
    if (!account.owner) {
      throw new Error('Provider registration owner relation was not loaded');
    }
    return {
      id: account.id,
      owner: {
        id: account.owner.id,
        email: account.owner.email,
        isEmailVerified: account.owner.isEmailVerified,
        role: 'customer',
        lastLogin: account.owner.lastLogin,
        createdAt: account.owner.createdAt,
        updatedAt: account.owner.updatedAt,
      },
      providerAccount: ProviderAccountMapper.toResponse(account),
    };
  }
}
