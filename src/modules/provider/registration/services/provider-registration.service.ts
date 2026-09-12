import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { BcryptService } from '../../../../common/security/bcrypt.service';
import { CustomerAccountErrorCodes } from '../../../customer/account/errors/customer-account-error-codes';
import { CustomerAccount } from '../../../customer/account/entities/customer-account.entity';
import { CustomerAccountService } from '../../../customer/account/services/customer-account.service';
import { ProviderAccountErrorCodes } from '../../account/errors/provider-account-error-codes';
import { ProviderAccount } from '../../account/entities/provider-account.entity';
import { ProviderAccountService } from '../../account/services/provider-account.service';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../../account/enums/account.enums';
import type { ProviderAccountResponse } from '../../account/dto/provider-account.response';
import type { RegisterProviderFromCustomerDto } from '../dto/register-provider-from-customer.dto';
import type { RegisterProviderDto } from '../dto/register-provider.dto';
import type { ProviderRegistrationResponse } from '../dto/provider-registration.response';

/** Handles provider registration and customer-to-provider registration requests. */
@Injectable()
export class ProviderRegistrationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly customerAccountService: CustomerAccountService,
    private readonly providerAccountService: ProviderAccountService,
    private readonly bcryptService: BcryptService,
  ) {}

  /**
   * Creates a customer authentication identity and a pending ProviderAccount in
   * one transaction. Customer identity remains a customer after approval;
   * provider capability is represented by ProviderAccount, not by replacing the
   * customer authentication identity.
   */
  async registerIndependent(
    dto: RegisterProviderDto,
  ): Promise<ProviderRegistrationResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const displayName = this.validateDisplayName(dto.displayName);
    this.validateType(dto.type);
    const passwordHash = await this.bcryptService.hash(dto.password);

    let customerId: string;
    try {
      customerId = await this.dataSource.transaction(async (manager) => {
        const customerRepository = manager.getRepository(CustomerAccount);
        const providerRepository = manager.getRepository(ProviderAccount);

        const customer = customerRepository.create({
          email: normalizedEmail,
          password: passwordHash,
        });
        const savedCustomer = await customerRepository.save(customer);

        const provider = providerRepository.create({
          ownerCustomerId: savedCustomer.id,
          type: dto.type,
          displayName,
          status: ProviderStatus.ACTIVE,
          verificationStatus: ProviderVerificationStatus.PENDING,
        });
        await providerRepository.save(provider);
        return savedCustomer.id;
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as { code?: string };
        if (driverError.code === '23505') {
          throw new BusinessException(
            CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_EMAIL_EXISTS,
            normalizedEmail,
          );
        }
      }
      throw error;
    }

    const providerAccount =
      await this.providerAccountService.getCurrent(customerId);
    return this.toResponse(customerId, providerAccount);
  }

  /** Creates a pending provider account for the authenticated customer. */
  async requestFromCustomer(
    authenticatedCustomerId: string,
    dto: RegisterProviderFromCustomerDto,
  ): Promise<ProviderRegistrationResponse> {
    const customer = await this.customerAccountService.findById(
      authenticatedCustomerId,
    );
    const providerAccount =
      await this.providerAccountService.createPendingForCustomer(
        customer.id,
        dto,
      );

    return this.toResponse(customer.id, providerAccount);
  }

  private validateType(type: ProviderType): void {
    if (!Object.values(ProviderType).includes(type)) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_INVALID_TYPE,
      );
    }
  }

  private validateDisplayName(displayName: string): string {
    const normalized = displayName.trim();
    if (!normalized) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_INVALID_DISPLAY_NAME,
      );
    }
    return normalized;
  }

  private toResponse(
    customerId: string,
    providerAccount: ProviderAccountResponse,
  ): ProviderRegistrationResponse {
    return { customerId, role: 'customer', providerAccount };
  }
}
