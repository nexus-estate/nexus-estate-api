import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { BaseService } from '../../../../services/abstraction-services';
import { BuyerAccountErrorCodes } from '../errors/buyer-account-error-codes';
import { RoleService } from '../../../rbac/services/role.service';
import { BuyerAccountRepository } from '../repositories/buyer-account.repository';
import type { CreateBuyerAccountInput } from '../dto/buyer-account.dto';
import type {
  BuyerAuthenticationAccount,
  SafeBuyerAccount,
} from '../types/buyer-account.type';
import { BuyerAccount } from '../models/buyer-account.entity';

/** Coordinates buyer-account validation, RBAC assignment, and persistence. */
@Injectable()
export class BuyerAccountService extends BaseService<
  BuyerAccount,
  BuyerAccountCreateData
> {
  constructor(
    private readonly buyerAccountRepository: BuyerAccountRepository,
    private readonly roleService: RoleService,
  ) {
    super(buyerAccountRepository, 'BuyerAccount');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private prepareEmail(email: string): string {
    const normalizedEmail = this.normalizeEmail(email);

    if (!normalizedEmail) {
      throw new BusinessException(
        CommonErrorCodes.VALIDATION_ERROR,
        'Email is required',
      );
    }

    return normalizedEmail;
  }

  /** Returns a buyer account without exposing its password hash. */
  async findById(id: string): Promise<SafeBuyerAccount> {
    const buyerAccount = await this.buyerAccountRepository.findSafeById(id);

    if (!buyerAccount) {
      throw new BusinessException(
        BuyerAccountErrorCodes.BUYER_ACCOUNT_NOT_FOUND,
        id,
      );
    }

    return buyerAccount;
  }

  /** Finds a buyer account by its normalized email address. */
  async findByEmail(email: string): Promise<SafeBuyerAccount | null> {
    const normalizedEmail = this.prepareEmail(email);

    return this.buyerAccountRepository.findByEmail(normalizedEmail);
  }

  /** Loads the credential projection required by buyer authentication. */
  async findByEmailForAuthentication(
    email: string,
  ): Promise<BuyerAuthenticationAccount | null> {
    const normalizedEmail = this.normalizeEmail(email);

    return this.buyerAccountRepository.findByEmailForAuthentication(
      normalizedEmail,
    );
  }

  /** Creates a buyer account after validating role and email uniqueness. */
  async handleCreate(
    input: CreateBuyerAccountInput,
  ): Promise<SafeBuyerAccount> {
    const normalizedEmail = this.prepareEmail(input.email);

    if (!normalizedEmail) {
      throw new BusinessException(
        CommonErrorCodes.VALIDATION_ERROR,
        'Email is required',
      );
    }

    await this.roleService.findById(input.roleId);

    const existingBuyerAccount =
      await this.buyerAccountRepository.findByEmail(normalizedEmail);

    if (existingBuyerAccount) {
      throw new BusinessException(
        BuyerAccountErrorCodes.BUYER_ACCOUNT_EMAIL_EXISTS,
        normalizedEmail,
      );
    }

    try {
      return await this.buyerAccountRepository.createBuyerAccount({
        email: normalizedEmail,
        password: input.passwordHash,
        roleId: input.roleId,
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === '23505') {
          throw new BusinessException(
            BuyerAccountErrorCodes.BUYER_ACCOUNT_EMAIL_EXISTS,
            normalizedEmail,
          );
        }
      }

      throw error;
    }
  }

  /** Stores the latest successful buyer authentication timestamp. */
  async updateLastLogin(buyerId: string, lastLogin: Date): Promise<void> {
    const updated = await this.buyerAccountRepository.updateLastLogin(
      buyerId,
      lastLogin,
    );

    if (!updated) {
      throw new BusinessException(
        BuyerAccountErrorCodes.BUYER_ACCOUNT_NOT_FOUND,
        buyerId,
      );
    }
  }

  /** Assigns a validated role to an active buyer and returns the refreshed account. */
  async updateRole(buyerId: string, roleId: string): Promise<SafeBuyerAccount> {
    const updated = await this.buyerAccountRepository.updateRole(
      buyerId,
      roleId,
    );
    if (!updated) {
      throw new BusinessException(
        BuyerAccountErrorCodes.BUYER_ACCOUNT_NOT_FOUND,
        buyerId,
      );
    }
    return this.findById(buyerId);
  }
}

/** Fields accepted by the inherited generic buyer-account create operation. */
type BuyerAccountCreateData = Pick<
  BuyerAccount,
  'email' | 'password' | 'roleId'
>;
