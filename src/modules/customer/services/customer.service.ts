import { Injectable } from '@nestjs/common';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { BcryptService } from '../../../common/security/bcrypt.service';
import { ROLES } from '../../../utils';
import { RbacErrorCodes } from '../../rbac/errors/rbac-error-codes';
import { RoleService } from '../../rbac/services/role.service';
import { CustomerAccountService } from './customer-account.service';
import type { SafeCustomerAccount } from '../types/customer-account.type';
import type { RegisterCustomerDto } from '../dto/register-customer.dto';

/** Application service for customer registration and customer self-service access. */
@Injectable()
export class CustomerService {
  constructor(
    private readonly customerAccountService: CustomerAccountService,
    private readonly roleService: RoleService,
    private readonly bcryptService: BcryptService,
  ) {}

  /** Creates a new customer using the system-controlled customer role. */
  async register(dto: RegisterCustomerDto): Promise<SafeCustomerAccount> {
    const customerRole = await this.roleService.findByName(ROLES.CUSTOMER);
    if (!customerRole) {
      throw new BusinessException(RbacErrorCodes.ROLE_NOT_FOUND);
    }

    const passwordHash = await this.bcryptService.hash(dto.password);
    return this.customerAccountService.handleCreate({
      email: dto.email,
      passwordHash,
      roleId: customerRole.id,
    });
  }

  /** Returns the authenticated customer profile without exposing credentials. */
  getCurrent(customerId: string): Promise<SafeCustomerAccount> {
    return this.customerAccountService.findById(customerId);
  }
}
