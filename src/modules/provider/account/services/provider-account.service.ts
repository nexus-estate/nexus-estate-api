import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { ProviderContextResolver } from './provider-context.resolver';
import { UpdateProviderAccountDto } from '../dto/index';
import { ProviderAccountResponse } from '../dto/provider-account.response';
import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { ProviderAccountMapper } from '../helpers/provider-account.mapper';
import { normalizeProviderDisplayName } from '../helpers/provider-account.validation';
import { ProviderAccountRepository } from '../repositories/provider-account.repository';

/** Application service exposing explicit read/update provider profile use cases. */
@Injectable()
export class ProviderAccountService {
  constructor(
    private readonly providerAccountRepository: ProviderAccountRepository,
    private readonly providerContextResolver: ProviderContextResolver,
  ) {}

  /** Loads the selected provider account after server-side membership/context validation. */
  async getCurrent(
    customerId: string,
    providerId?: string,
  ): Promise<ProviderAccountResponse> {
    const context = await this.providerContextResolver.resolve(
      customerId,
      providerId,
    );
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

  /** Updates only the selected provider profile after context and ownership checks. */
  async updateCurrent(
    customerId: string,
    dto: UpdateProviderAccountDto,
    providerId?: string,
  ): Promise<ProviderAccountResponse> {
    const context = await this.providerContextResolver.resolve(
      customerId,
      providerId,
    );
    const account = await this.providerAccountRepository.findById(
      context.providerId,
    );

    if (!account) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND,
      );
    }

    const updated = await this.providerAccountRepository.update(
      context.providerId,
      {
        displayName: normalizeProviderDisplayName(dto.displayName),
      },
    );
    return ProviderAccountMapper.toResponse(updated);
  }
}
