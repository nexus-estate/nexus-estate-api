import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes, ROLES } from '../../../utils';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/service/user.service';
import { RoleService } from '../../rbac/services/role.service';
import { SellerAccountService } from '../../seller-platform/account/services/account.service';
import { SellerAccountRepository } from '../../seller-platform/account/repositories/account.repository';
import { SellerAccount } from '../../seller-platform/account/models/account.entity';
import { SellerAccountMapper } from '../../seller-platform/account/helpers/account.mapper';
import {
  SellerStatus,
  SellerVerificationStatus,
} from '../../seller-platform/account/enums/account.enums';
import type { SellerRegistrationResponse } from '../dto/seller-registration.response';
import type { SellerRegistrationReviewResponse } from '../dto/seller-registration-review.response';

/** Provides administrator review and approval operations for seller requests. */
@Injectable()
export class SellerApprovalService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
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
        ErrorCodes.SELLER_ACCOUNT_NOT_FOUND,
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
      throw new BusinessException(ErrorCodes.ROLE_NOT_FOUND);
    }

    let ownerUserId: string;
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
          ErrorCodes.SELLER_ACCOUNT_NOT_FOUND,
          accountId,
        );
      }
      const owner = await manager.findOne(User, {
        where: { id: account.ownerUserId },
        relations: { role: true },
      });
      if (!owner || owner.role.name !== ROLES.BUYER) {
        throw new BusinessException(
          ErrorCodes.SELLER_ACCOUNT_NOT_PENDING,
          accountId,
        );
      }

      ownerUserId = account.ownerUserId;
      await manager.update(User, ownerUserId, { roleId: sellerRole.id });
      await manager.update(SellerAccount, accountId, {
        status: SellerStatus.ACTIVE,
        verificationStatus: SellerVerificationStatus.VERIFIED,
      });
    });

    const approvedUser = await this.userService.findById(ownerUserId!);
    const sellerAccount = await this.sellerAccountService.getCurrent(
      ownerUserId!,
    );
    return {
      userId: approvedUser.id,
      role: approvedUser.role.name,
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
