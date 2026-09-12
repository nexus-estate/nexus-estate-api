import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { ROLES } from '../../../utils/constants/role.constant';
import { RbacErrorCodes } from '../../rbac/errors/rbac-error-codes';
import { BuyerAccount } from '../../buyer/account/models/buyer-account.entity';
import { BuyerAccountService } from '../../buyer/account/services/buyer-account.service';
import { RoleService } from '../../rbac/services/role.service';
import { SellerAccountService } from '../../seller-platform/account/services/account.service';
import { SellerAccountRepository } from '../../seller-platform/account/repositories/account.repository';
import { SellerAccount } from '../../seller-platform/account/models/account.entity';
import { SellerAccountMapper } from '../../seller-platform/account/helpers/account.mapper';
import {
  SellerStatus,
  SellerVerificationStatus,
} from '../../seller-platform/account/enums/account.enums';
import { SellerAccountErrorCodes } from '../../seller-platform/account/errors/seller-account-error-codes';
import type { SellerRegistrationResponse } from '../../seller/dto/seller-registration.response';
import type { SellerRegistrationReviewResponse } from '../dto/seller-registration-review.response';

/** Provides administrator review and approval operations for seller requests. */
@Injectable()
export class SellerRegistrationAdministrationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly buyerAccountService: BuyerAccountService,
    private readonly roleService: RoleService,
    private readonly sellerAccountRepository: SellerAccountRepository,
    private readonly sellerAccountService: SellerAccountService,
  ) {}

  /** Lists all pending seller-registration requests in submission order. */
  async findPending(): Promise<SellerRegistrationReviewResponse[]> {
    const accounts = await this.sellerAccountRepository.findPendingForReview();
    return accounts.map((account) => this.toReviewResponse(account));
  }

  /** Returns one pending request with the buyer data needed for a decision. */
  async findPendingById(
    accountId: string,
  ): Promise<SellerRegistrationReviewResponse> {
    const account =
      await this.sellerAccountRepository.findPendingByIdForReview(accountId);
    if (!account) {
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_NOT_FOUND,
        accountId,
      );
    }
    return this.toReviewResponse(account);
  }

  /**
   * Approves a pending request atomically and upgrades its owner to seller.
   *
   * Both role and verification state change in one transaction so a failed
   * approval cannot leave a buyer with a partially activated seller account.
   */
  async approve(accountId: string): Promise<SellerRegistrationResponse> {
    const sellerRole = await this.roleService.findByName(ROLES.SELLER);
    if (!sellerRole) {
      throw new BusinessException(RbacErrorCodes.ROLE_NOT_FOUND);
    }

    let ownerBuyerId: string;
    await this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(SellerAccount, {
        where: {
          id: accountId,
          verificationStatus: SellerVerificationStatus.PENDING,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!account) {
        throw new BusinessException(
          SellerAccountErrorCodes.SELLER_ACCOUNT_NOT_FOUND,
          accountId,
        );
      }
      const owner = await manager.findOne(BuyerAccount, {
        where: { id: account.ownerBuyerId },
        relations: { role: true },
      });
      if (!owner || owner.role.name !== ROLES.BUYER) {
        throw new BusinessException(
          SellerAccountErrorCodes.SELLER_ACCOUNT_NOT_PENDING,
          accountId,
        );
      }

      ownerBuyerId = account.ownerBuyerId;
      await manager.update(BuyerAccount, ownerBuyerId, {
        roleId: sellerRole.id,
      });
      await manager.update(SellerAccount, accountId, {
        status: SellerStatus.ACTIVE,
        verificationStatus: SellerVerificationStatus.VERIFIED,
      });
    });

    const approvedBuyer = await this.buyerAccountService.findById(
      ownerBuyerId!,
    );
    const sellerAccount = await this.sellerAccountService.getCurrent(
      ownerBuyerId!,
    );
    return {
      buyerId: approvedBuyer.id,
      role: approvedBuyer.role.name,
      sellerAccount,
    };
  }

  private toReviewResponse(
    account: SellerAccount,
  ): SellerRegistrationReviewResponse {
    if (!account.owner) {
      throw new Error('Seller registration owner relation was not loaded');
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
      sellerAccount: SellerAccountMapper.toResponse(account),
    };
  }
}
