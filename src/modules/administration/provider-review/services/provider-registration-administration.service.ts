import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CustomerAccount } from '../../../customer/account/entities/customer-account.entity';
import { CustomerAccountService } from '../../../customer/account/services/customer-account.service';
import { ProviderAccountService } from '../../../provider/account/services/provider-account.service';
import { ProviderAccountRepository } from '../../../provider/account/repositories/provider-account.repository';
import { ProviderAccount } from '../../../provider/account/entities/provider-account.entity';
import { ProviderAccountMapper } from '../../../provider/account/helpers/provider-account.mapper';
import {
  ProviderStatus,
  ProviderVerificationStatus,
} from '../../../provider/account/enums/account.enums';
import { ProviderAccountErrorCodes } from '../../../provider/account/errors/provider-account-error-codes';
import type { ProviderRegistrationResponse } from '../../../provider/registration/dto/provider-registration.response';
import type { ProviderRegistrationReviewResponse } from '../dto/provider-registration-review.response';

/** Provides administration review and approval operations for provider requests. */
@Injectable()
export class ProviderRegistrationAdministrationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly customerAccountService: CustomerAccountService,
    private readonly providerAccountRepository: ProviderAccountRepository,
    private readonly providerAccountService: ProviderAccountService,
  ) {}

  async findPending(): Promise<ProviderRegistrationReviewResponse[]> {
    const accounts =
      await this.providerAccountRepository.findPendingForReview();
    return accounts.map((account) => this.toReviewResponse(account));
  }

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

  /** Approves a pending ProviderAccount without replacing customer identity. */
  async approve(accountId: string): Promise<ProviderRegistrationResponse> {
    let ownerCustomerId = '';
    await this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(ProviderAccount, {
        where: { id: accountId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) {
        throw new BusinessException(
          ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND,
          accountId,
        );
      }
      if (account.verificationStatus !== ProviderVerificationStatus.PENDING) {
        throw new BusinessException(
          ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_PENDING,
          accountId,
        );
      }

      const owner = await manager.findOne(CustomerAccount, {
        where: { id: account.ownerCustomerId },
      });
      if (!owner) {
        throw new BusinessException(
          ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
          accountId,
        );
      }

      ownerCustomerId = account.ownerCustomerId;
      await manager.update(ProviderAccount, accountId, {
        status: ProviderStatus.ACTIVE,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      });
    });

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
