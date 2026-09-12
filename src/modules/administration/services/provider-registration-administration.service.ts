import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { ROLES } from '../../../utils/constants/role.constant';
import { RbacErrorCodes } from '../../rbac/errors/rbac-error-codes';
import { CustomerAccount } from '../../customer/models/customer-account.entity';
import { CustomerAccountService } from '../../customer/services/customer-account.service';
import { RoleService } from '../../rbac/services/role.service';
import { ProviderAccountService } from '../../provider/services/provider-account.service';
import { ProviderAccountRepository } from '../../provider/repositories/provider-account.repository';
import { ProviderAccount } from '../../provider/models/provider-account.entity';
import { ProviderAccountMapper } from '../../provider/helpers/provider-account.mapper';
import {
  ProviderStatus,
  ProviderVerificationStatus,
} from '../../provider/enums/account.enums';
import { ProviderAccountErrorCodes } from '../../provider/errors/provider-account-error-codes';
import type { ProviderRegistrationResponse } from '../../provider/dto/provider-registration.response';
import type { ProviderRegistrationReviewResponse } from '../dto/provider-registration-review.response';

/** Provides administration review and approval operations for provider requests. */
@Injectable()
export class ProviderRegistrationAdministrationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly customerAccountService: CustomerAccountService,
    private readonly roleService: RoleService,
    private readonly providerAccountRepository: ProviderAccountRepository,
    private readonly providerAccountService: ProviderAccountService,
  ) {}

  /** Lists pending provider-registration requests in submission order. */
  async findPending(): Promise<ProviderRegistrationReviewResponse[]> {
    const accounts =
      await this.providerAccountRepository.findPendingForReview();
    return accounts.map((account) => this.toReviewResponse(account));
  }

  /** Returns one pending request with the customer data needed for a decision. */
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

  /** Approves a pending request atomically and upgrades its owner to provider. */
  async approve(accountId: string): Promise<ProviderRegistrationResponse> {
    const providerRole = await this.roleService.findByName(ROLES.PROVIDER);
    if (!providerRole) {
      throw new BusinessException(RbacErrorCodes.ROLE_NOT_FOUND);
    }

    let ownerCustomerId = '';
    await this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(ProviderAccount, {
        where: {
          id: accountId,
          verificationStatus: ProviderVerificationStatus.PENDING,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) {
        throw new BusinessException(
          ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND,
          accountId,
        );
      }

      const owner = await manager.findOne(CustomerAccount, {
        where: { id: account.ownerCustomerId },
        relations: { role: true },
      });
      if (!owner || owner.role.name !== ROLES.CUSTOMER) {
        throw new BusinessException(
          ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_PENDING,
          accountId,
        );
      }

      ownerCustomerId = account.ownerCustomerId;
      await manager.update(CustomerAccount, ownerCustomerId, {
        roleId: providerRole.id,
      });
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
      role: customer.role.name,
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
        role: account.owner.role.name,
        lastLogin: account.owner.lastLogin,
        createdAt: account.owner.createdAt,
        updatedAt: account.owner.updatedAt,
      },
      providerAccount: ProviderAccountMapper.toResponse(account),
    };
  }
}
