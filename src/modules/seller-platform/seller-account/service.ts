import { Injectable, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { CurrentSellerContext } from './current-seller-context';
import { CreateSellerAccountDto, UpdateSellerAccountDto } from './dto';
import { SellerAccountResponse } from './dto/seller-account.response';
import { SellerAccountErrorCodes } from './errors';
import { SellerAccountMapper } from './mapper';
import { SellerAccountPolicy } from './policy';
import { SellerAccountRepository } from './repository';
import { SellerStatus, SellerType, SellerVerificationStatus } from './enums';

@Injectable()
export class SellerAccountService {
  private readonly logger = new Logger(SellerAccountService.name);

  constructor(
    private readonly sellerAccountRepository: SellerAccountRepository,
    private readonly currentSellerContext: CurrentSellerContext,
    private readonly sellerAccountPolicy: SellerAccountPolicy,
  ) {}

  async create(
    userId: string,
    dto: CreateSellerAccountDto,
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
      const account = await this.sellerAccountRepository.save({
        ownerUserId: userId,
        type: dto.type,
        displayName,
        status: SellerStatus.ACTIVE,
        verificationStatus: SellerVerificationStatus.UNVERIFIED,
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
    account.displayName = this.validateDisplayName(dto.displayName);
    const updated = await this.sellerAccountRepository.save(account);
    this.logger.log(
      JSON.stringify({
        operation: 'seller_account.profile_updated',
        user_id: userId,
        seller_id: updated.id,
      }),
    );
    return SellerAccountMapper.toResponse(updated);
  }

  resolveCurrentSeller(userId: string) {
    return this.currentSellerContext.resolve(userId);
  }

  requireActiveSeller(userId: string) {
    return this.resolveCurrentSeller(userId).then((context) => {
      this.sellerAccountPolicy.requireActiveSeller(context);
      return context;
    });
  }

  private validateType(
    type: SellerType | undefined,
  ): asserts type is SellerType {
    if (!Object.values(SellerType).includes(type as SellerType)) {
      throw new BusinessException(
        SellerAccountErrorCodes.SELLER_ACCOUNT_INVALID_TYPE,
      );
    }
  }

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
