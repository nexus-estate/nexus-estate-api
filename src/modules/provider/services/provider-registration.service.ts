import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { BcryptService } from '../../../common/security/bcrypt.service';
import { ROLES } from '../../../utils/constants/role.constant';
import { RbacErrorCodes } from '../../rbac/errors/rbac-error-codes';
import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { RoleService } from '../../rbac/services/role.service';
import { CustomerAccountService } from '../../customer/services/customer-account.service';
import { ProviderAccountService } from './provider-account.service';
import type { ProviderAccountResponse } from '../dto/provider-account.response';
import type { RegisterProviderFromCustomerDto } from '../dto/register-provider-from-customer.dto';
import type { RegisterProviderDto } from '../dto/register-provider.dto';
import type { ProviderRegistrationResponse } from '../dto/provider-registration.response';

/** Handles provider registration and customer-to-provider registration requests. */
@Injectable()
export class ProviderRegistrationService {
  constructor(
    private readonly customerAccountService: CustomerAccountService,
    private readonly roleService: RoleService,
    private readonly providerAccountService: ProviderAccountService,
    private readonly bcryptService: BcryptService,
  ) {}

  /** Creates an independent provider account without a customer approval request. */
  async registerIndependent(
    dto: RegisterProviderDto,
  ): Promise<ProviderRegistrationResponse> {
    const providerRole = await this.requireRole(ROLES.PROVIDER);
    const passwordHash = await this.bcryptService.hash(dto.password);
    const customerAccount = await this.customerAccountService.handleCreate({
      email: dto.email,
      passwordHash,
      roleId: providerRole.id,
    });
    const providerAccount = await this.providerAccountService.createForCustomer(
      customerAccount.id,
      dto,
    );

    return this.toResponse(
      customerAccount.id,
      customerAccount.role.name,
      providerAccount,
    );
  }

  /**
   * Creates a pending provider account for the authenticated customer.
   *
   * The customer remains a customer until an administrator approves the request.
   */
  async requestFromCustomer(
    authenticatedCustomerId: string,
    dto: RegisterProviderFromCustomerDto,
  ): Promise<ProviderRegistrationResponse> {
    if (authenticatedCustomerId !== dto.customerId) {
      throw new BusinessException(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN,
        'You can only submit a request for your own account',
      );
    }

    const customer = await this.customerAccountService.findById(dto.customerId);
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

  private toResponse(
    customerId: string,
    role: string,
    providerAccount: ProviderAccountResponse,
  ): ProviderRegistrationResponse {
    return { customerId, role, providerAccount };
  }
}
