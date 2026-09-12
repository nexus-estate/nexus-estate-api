import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { BaseService } from '../../../../services/abstraction-services';
import {
  CurrentSellerContext,
  type CurrentSellerContextValue,
} from './current-seller-context.service';
import { CreateSellerAccountDto, UpdateSellerAccountDto } from '../dto';
import { SellerAccountResponse } from '../dto/account.response';
import { SellerAccountErrorCodes } from '../helpers/errors';
import { SellerAccountMapper } from '../helpers/account.mapper';
import { SellerAccountPolicy } from '../helpers/account.policy';
import { SellerAccount } from '../models/account.entity';
import { SellerAccountRepository } from '../repositories/account.repository';
import {
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from '../enums/account.enums';

/**
 * Application service for seller-account lifecycle and seller context rules.
 *
 * BaseService supplies generic entity CRUD; the methods in this class add
 * authenticated-user scoping, validation, response mapping, and domain errors.
 */
@Injectable()
export class SellerAccountService extends BaseService<
  SellerAccount,
  SellerAccountCreateData,
  SellerAccountUpdateData
> {
  constructor(
    private readonly sellerAccountRepository: SellerAccountRepository,
    private readonly currentSellerContext: CurrentSellerContext,
    private readonly sellerAccountPolicy: SellerAccountPolicy,
  ) {
    super(sellerAccountRepository, 'SellerAccount');
  }

  /**
   * Creates the authenticated user's seller account.
   *
   * The base service owns persistence mechanics; this method owns the
   * seller-specific validation, defaults, and conflict translation.
   */
  async createForUser(
    userId: string,
    dto: CreateSellerAccountDto,
  ): Promise<SellerAccountResponse> {
    return this.createForUserWithVerification(
      userId,
      dto,
      SellerVerificationStatus.UNVERIFIED,
    );
  }

  /** Creates a seller account that is waiting for administrator approval. */
  async createPendingForUser(
    userId: string,
    dto: CreateSellerAccountDto,
  ): Promise<SellerAccountResponse> {
    return this.createForUserWithVerification(
      userId,
      dto,
      SellerVerificationStatus.PENDING,
    );
  }

  /** Persists a seller account with the requested onboarding state. */
  private async createForUserWithVerification(
    userId: string,
    dto: CreateSellerAccountDto,
    verificationStatus: SellerVerificationStatus,
  ): Promise<SellerAccountResponse> {
    this.validateType(dto.type);
    const displayName = this.validateDisplayName(dto.displayName);

    if (await this.sellerAccountRepository.existsByOwnerUserId(userId)) {
      this.logger.warn(
        JSON.stringify({
          operation: 'seller_account.create_duplicate',
          user_id: userId,
        }),
      );
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_ALREADY_EXISTS,
      );
    }

    try {
      const account = await super.create({
        ownerUserId: userId,
        type: dto.type,
        displayName,
        status: SellerStatus.ACTIVE,
        verificationStatus,
      });

      this.logger.log(
        JSON.stringify({
          operation: 'seller_account.created',
          user_id: userId,
          seller_id: account.id,
        }),
      );

      return SellerAccountMapper.toResponse(account);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as { code?: string };
        if (driverError.code === '23505') {
          throw new BusinessException(
            SellerAccountErrorCodes.SELLER_ACCOUNT_ALREADY_EXISTS,
          );
        }
      }

      throw error;
    }
  }

  /** Returns the current user's account without creating one implicitly. */
  async getCurrent(userId: string): Promise<SellerAccountResponse> {
    const context = await this.currentSellerContext.resolve(userId);
    const account = await this.sellerAccountRepository.findById(
      context.sellerId,
    );

    if (!account) {
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_NOT_FOUND,
      );
    }

    return SellerAccountMapper.toResponse(account);
  }

  /** Updates only fields that are editable through the seller profile API. */
  async updateCurrent(
    userId: string,
    dto: UpdateSellerAccountDto,
  ): Promise<SellerAccountResponse> {
    const context = await this.currentSellerContext.resolve(userId);
    const account = await this.sellerAccountRepository.findById(
      context.sellerId,
    );

    if (!account) {
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_NOT_FOUND,
      );
    }

    // Profile editing is allowed while suspended; supply mutations use the policy.
    const updated = await super.update(context.sellerId, {
      displayName: this.validateDisplayName(dto.displayName),
    });
    this.logger.log(
      JSON.stringify({
        operation: 'seller_account.profile_updated',
        user_id: userId,
        seller_id: updated.id,
      }),
    );
    return SellerAccountMapper.toResponse(updated);
  }

  /** Resolves the reusable seller context used by downstream supply features. */
  resolveCurrentSeller(userId: string): Promise<CurrentSellerContextValue> {
    return this.currentSellerContext.resolve(userId);
  }

  /** Rejects supply mutations when the current seller is suspended. */
  requireActiveSeller(userId: string): Promise<CurrentSellerContextValue> {
    return this.resolveCurrentSeller(userId).then((context) => {
      this.sellerAccountPolicy.requireActiveSeller(context);
      return context;
    });
  }

  /** Ensures the request uses a value supported by the database check constraint. */
  private validateType(
    type: SellerType | undefined,
  ): asserts type is SellerType {
    if (!Object.values(SellerType).includes(type as SellerType)) {
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_INVALID_TYPE,
      );
    }
  }

  /** Trims and validates the display name before it reaches persistence. */
  private validateDisplayName(displayName: string | undefined): string {
    const normalized = displayName?.trim();
    if (!normalized) {
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_INVALID_DISPLAY_NAME,
      );
    }
    return normalized;
  }
}

/** Fields accepted by the inherited generic BaseService.create operation. */
type SellerAccountCreateData = Pick<
  SellerAccount,
  'ownerUserId' | 'type' | 'displayName' | 'status' | 'verificationStatus'
>;

/** Fields accepted by the inherited generic BaseService.update operation. */
type SellerAccountUpdateData = Pick<SellerAccount, 'displayName'>;
