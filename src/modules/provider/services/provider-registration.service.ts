import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { BcryptService } from '../../../common/security/bcrypt.service';
import { ROLES } from '../../../utils/constants/role.constant';
import { RbacErrorCodes } from '../../rbac/errors/rbac-error-codes';
import { CustomerAccountErrorCodes } from '../../customer/errors/customer-account-error-codes';
import { CustomerAccount } from '../../customer/models/customer-account.entity';
import { CustomerAccountService } from '../../customer/services/customer-account.service';
import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { ProviderAccount } from '../models/provider-account.entity';
import { RoleService } from '../../rbac/services/role.service';
import { ProviderAccountService } from './provider-account.service';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../enums/account.enums';
import type { ProviderAccountResponse } from '../dto/provider-account.response';
import type { RegisterProviderFromCustomerDto } from '../dto/register-provider-from-customer.dto';
import type { RegisterProviderDto } from '../dto/register-provider.dto';
import type { ProviderRegistrationResponse } from '../dto/provider-registration.response';

/** Handles provider registration and customer-to-provider registration requests. */
@Injectable()
export class ProviderRegistrationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly customerAccountService: CustomerAccountService,
    private readonly roleService: RoleService,
    private readonly providerAccountService: ProviderAccountService,
    private readonly bcryptService: BcryptService,
  ) {}

  /**
   * Creates a customer authentication identity and a pending ProviderAccount in
   * one transaction. Customer identity remains a customer after approval;
   * provider capability is represented by ProviderAccount, not by replacing the
   * authentication role.
   */
  async registerIndependent(
    dto: RegisterProviderDto,
  ): Promise<ProviderRegistrationResponse> {
    const customerRole = await this.requireRole(ROLES.CUSTOMER);
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
          roleId: customerRole.id,
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
    return this.toResponse(customerId, customerRole.name, providerAccount);
  }

  /** Creates a pending provider account for the authenticated customer. */
  async requestFromCustomer(
    authenticatedCustomerId: string,
    dto: RegisterProviderFromCustomerDto,
  ): Promise<ProviderRegistrationResponse> {
    const customer =
      await this.customerAccountService.findById(authenticatedCustomerId);
    if (customer.role.name !== ROLES.CUSTOMER) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
        'Only customers can submit a provider-registration request',
      );
    }

    const providerAccount =
      await this.providerAccountService.createPendingForCustomer(
        customer.id,
        dto,
      );

    return this.toResponse(customer.id, customer.role.name, providerAccount);
  }

  private async requireRole(roleName: string) {
    const role = await this.roleService.findByName(roleName);
    if (!role) {
      throw new BusinessException(RbacErrorCodes.ROLE_NOT_FOUND);
    }
    return role;
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
    role: string,
    providerAccount: ProviderAccountResponse,
  ): ProviderRegistrationResponse {
    return { customerId, role, providerAccount };
  }
}
