import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { BaseService } from '../../../services/abstraction-services';
import {
  CurrentProviderContext,
  type CurrentProviderContextValue,
} from './current-provider-context.service';
import { CreateProviderAccountDto, UpdateProviderAccountDto } from '../dto';
import { ProviderAccountResponse } from '../dto/provider-account.response';
import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { ProviderAccountMapper } from '../helpers/provider-account.mapper';
import { ProviderAccountPolicy } from '../helpers/provider-account.policy';
import { ProviderAccount } from '../models/provider-account.entity';
import { ProviderAccountRepository } from '../repositories/provider-account.repository';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';

/** Application service for provider-account lifecycle and provider context rules. */
@Injectable()
export class ProviderAccountService extends BaseService<
  ProviderAccount,
  ProviderAccountCreateData,
  ProviderAccountUpdateData
> {
  constructor(
    private readonly providerAccountRepository: ProviderAccountRepository,
    private readonly currentProviderContext: CurrentProviderContext,
    private readonly providerAccountPolicy: ProviderAccountPolicy,
  ) {
    super(providerAccountRepository, 'ProviderAccount');
  }

  /** Creates a provider request for the authenticated customer. */
  async createForCustomer(
    customerId: string,
    dto: CreateProviderAccountDto,
  ): Promise<ProviderAccountResponse> {
    return this.createForCustomerWithVerification(
      customerId,
      dto,
      ProviderVerificationStatus.PENDING,
    );
  }

  /** Creates a provider account that is waiting for administrator approval. */
  async createPendingForCustomer(
    customerId: string,
    dto: CreateProviderAccountDto,
  ): Promise<ProviderAccountResponse> {
    return this.createForCustomerWithVerification(
      customerId,
      dto,
      ProviderVerificationStatus.PENDING,
    );
  }

  /** Persists a provider account with the requested onboarding state. */
  private async createForCustomerWithVerification(
    customerId: string,
    dto: CreateProviderAccountDto,
    verificationStatus: ProviderVerificationStatus,
  ): Promise<ProviderAccountResponse> {
    this.validateType(dto.type);
    const displayName = this.validateDisplayName(dto.displayName);

    if (
      await this.providerAccountRepository.existsByOwnerCustomerId(customerId)
    ) {
      this.logger.warn(
        JSON.stringify({
          operation: 'provider_account.create_duplicate',
          customer_id: customerId,
        }),
      );
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_ALREADY_EXISTS,
      );
    }

    try {
      const account = await super.create({
        ownerCustomerId: customerId,
        type: dto.type,
        displayName,
        status: ProviderStatus.ACTIVE,
        verificationStatus,
      });

      this.logger.log(
        JSON.stringify({
          operation: 'provider_account.created',
          customer_id: customerId,
          provider_id: account.id,
          verification_status: account.verificationStatus,
        }),
      );

      return ProviderAccountMapper.toResponse(account);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as { code?: string };
        if (driverError.code === '23505') {
          throw new BusinessException(
            ProviderAccountErrorCodes.PROVIDER_ACCOUNT_ALREADY_EXISTS,
          );
        }
      }

      throw error;
    }
  }

  /** Returns the current customer's account without creating one implicitly. */
  async getCurrent(customerId: string): Promise<ProviderAccountResponse> {
    const context = await this.currentProviderContext.resolve(customerId);
    const account = await this.providerAccountRepository.findById(
      context.providerId,
    );

    if (!account) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND,
      );
    }

    return ProviderAccountMapper.toResponse(account);
  }

  /** Updates only fields that are editable through the provider profile API. */
  async updateCurrent(
    customerId: string,
    dto: UpdateProviderAccountDto,
  ): Promise<ProviderAccountResponse> {
    const context = await this.currentProviderContext.resolve(customerId);
    const account = await this.providerAccountRepository.findById(
      context.providerId,
    );

    if (!account) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND,
      );
    }

    const updated = await super.update(context.providerId, {
      displayName: this.validateDisplayName(dto.displayName),
    });
    this.logger.log(
      JSON.stringify({
        operation: 'provider_account.profile_updated',
        customer_id: customerId,
        provider_id: updated.id,
      }),
    );
    return ProviderAccountMapper.toResponse(updated);
  }

  resolveCurrentProvider(
    customerId: string,
  ): Promise<CurrentProviderContextValue> {
    return this.currentProviderContext.resolve(customerId);
  }

  /** Rejects supply mutations unless the provider is active and verified. */
  requireActiveProvider(
    customerId: string,
  ): Promise<CurrentProviderContextValue> {
    return this.resolveCurrentProvider(customerId).then((context) => {
      this.providerAccountPolicy.requireActiveProvider(context);
      return context;
    });
  }

  private validateType(
    type: ProviderType | undefined,
  ): asserts type is ProviderType {
    if (!Object.values(ProviderType).includes(type as ProviderType)) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_INVALID_TYPE,
      );
    }
  }

  private validateDisplayName(displayName: string | undefined): string {
    const normalized = displayName?.trim();
    if (!normalized) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_INVALID_DISPLAY_NAME,
      );
    }
    return normalized;
  }
}

type ProviderAccountCreateData = Pick<
  ProviderAccount,
  'ownerCustomerId' | 'type' | 'displayName' | 'status' | 'verificationStatus'
>;

type ProviderAccountUpdateData = Pick<ProviderAccount, 'displayName'>;
