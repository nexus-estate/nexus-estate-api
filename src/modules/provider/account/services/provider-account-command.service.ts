import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CustomerAccount } from '../../../customer/account/entities/customer-account.entity';
import { CreateProviderAccountDto } from '../dto/index';
import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { ProviderAccount } from '../entities/provider-account.entity';
import { ProviderAccountRepository } from '../repositories/provider-account.repository';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';
import {
  assertValidProviderType,
  normalizeProviderDisplayName,
} from '../helpers/provider-account.validation';
import { ProviderAuthorizationService } from '../../authorization/services/provider-authorization.service';

/** Provider creation input retained by the command boundary. */
export type CreatePendingProviderInput = {
  readonly type: ProviderType;
  readonly displayName: string;
};

/**
 * Owns every provider-account lifecycle mutation and its invariants: pending
 * creation, owner-membership provisioning, and administrator approval. Reads
 * stay in ProviderAccountService; callers reload through canonical read logic
 * after a mutation instead of trusting a partially-populated response.
 */
@Injectable()
export class ProviderAccountCommandService {
  private readonly logger = new Logger(ProviderAccountCommandService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly providerAccountRepository: ProviderAccountRepository,
    private readonly providerAuthorizationService: ProviderAuthorizationService,
  ) {}

  /**
   * Creates a pending provider account owned by an existing customer within
   * its own transaction and returns the new provider identifier.
   */
  async createPending(
    customerId: string,
    dto: CreateProviderAccountDto,
  ): Promise<string> {
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
      const providerId = await this.dataSource.transaction((manager) =>
        this.createWithManager(manager, customerId, dto),
      );
      this.logger.log(
        JSON.stringify({
          operation: 'provider_account.created',
          customer_id: customerId,
          provider_id: providerId,
          verification_status: ProviderVerificationStatus.PENDING,
        }),
      );
      return providerId;
    } catch (error) {
      throw this.translateConflict(error);
    }
  }

  /**
   * Creates a pending provider account inside the caller's transaction and
   * provisions its initial OWNER membership. Use this when provider creation
   * must be atomic with another write, such as independent registration.
   */
  async createWithManager(
    manager: EntityManager,
    ownerCustomerId: string,
    input: CreatePendingProviderInput,
  ): Promise<string> {
    assertValidProviderType(input.type);
    const displayName = normalizeProviderDisplayName(input.displayName);
    const repository = manager.getRepository(ProviderAccount);
    const account = repository.create({
      ownerCustomerId,
      type: input.type,
      displayName,
      status: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.PENDING,
    });
    const saved = await repository.save(account);
    await this.providerAuthorizationService.ensureOwnerMembership(
      manager,
      saved.id,
      ownerCustomerId,
    );
    return saved.id;
  }

  /**
   * Approves one pending provider account and returns the owner identifier so
   * callers can reload the canonical provider response.
   */
  async approve(
    accountId: string,
  ): Promise<{ providerId: string; ownerCustomerId: string }> {
    return this.dataSource.transaction(async (manager) => {
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

      await manager.update(ProviderAccount, accountId, {
        status: ProviderStatus.ACTIVE,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      });

      return {
        providerId: accountId,
        ownerCustomerId: account.ownerCustomerId,
      };
    });
  }

  /** Translates unique-constraint failures into a stable business error. */
  private translateConflict(error: unknown): unknown {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string };
      if (driverError.code === '23505') {
        return new BusinessException(
          ProviderAccountErrorCodes.PROVIDER_ACCOUNT_ALREADY_EXISTS,
        );
      }
    }
    return error;
  }
}
