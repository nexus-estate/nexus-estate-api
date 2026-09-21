import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { BcryptService } from '../../../../common/security/bcrypt.service';
import { CustomerAccountErrorCodes } from '../../../customer/account/errors/customer-account-error-codes';
import { CustomerAccount } from '../../../customer/account/entities/customer-account.entity';
import { CustomerAccountService } from '../../../customer/account/services/customer-account.service';
import { ProviderAccountService } from '../../account/services/provider-account.service';
import { ProviderAccountCommandService } from '../../account/services/provider-account-command.service';
import type { ProviderAccountResponse } from '../../account/dto/provider-account.response';
import type { RegisterProviderFromCustomerDto } from '../dto/register-provider-from-customer.dto';
import type { RegisterProviderDto } from '../dto/register-provider.dto';
import type { ProviderRegistrationResponse } from '../dto/provider-registration.response';

/** Orchestrates provider registration requests over the provider command boundary. */
@Injectable()
export class ProviderRegistrationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly customerAccountService: CustomerAccountService,
    private readonly providerAccountService: ProviderAccountService,
    private readonly providerAccountCommandService: ProviderAccountCommandService,
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
    const passwordHash = await this.bcryptService.hash(dto.password);

    let registrationIds: { customerId: string; providerId: string };
    try {
      registrationIds = await this.dataSource.transaction(async (manager) => {
        const customerRepository = manager.getRepository(CustomerAccount);
        const customer = customerRepository.create({
          email: normalizedEmail,
          password: passwordHash,
        });
        const savedCustomer = await customerRepository.save(customer);

        const providerId =
          await this.providerAccountCommandService.createWithManager(
            manager,
            savedCustomer.id,
            { type: dto.type, displayName: dto.displayName },
          );
        return { customerId: savedCustomer.id, providerId };
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

    const providerAccount = await this.providerAccountService.getCurrent(
      registrationIds.customerId,
      registrationIds.providerId,
    );
    return this.toResponse(registrationIds.customerId, providerAccount);
  }

  /** Creates a provider registration request for an already authenticated customer. */
  async requestFromCustomer(
    authenticatedCustomerId: string,
    dto: RegisterProviderFromCustomerDto,
  ): Promise<ProviderRegistrationResponse> {
    const customer = await this.customerAccountService.findById(
      authenticatedCustomerId,
    );
    const providerId = await this.providerAccountCommandService.createPending(
      customer.id,
      dto,
    );
    const providerAccount = await this.providerAccountService.getCurrent(
      customer.id,
      providerId,
    );

    return this.toResponse(customer.id, providerAccount);
  }

  private toResponse(
    customerId: string,
    providerAccount: ProviderAccountResponse,
  ): ProviderRegistrationResponse {
    return { customerId, role: 'customer', providerAccount };
  }
}
