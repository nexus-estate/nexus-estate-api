import { Injectable } from '@nestjs/common';

import { BcryptService } from '../../../../common/security/bcrypt.service';
import { CustomerAccountService } from './customer-account.service';
import type { SafeCustomerAccount } from '../types/customer-account.type';
import type { RegisterCustomerDto } from '../../authentication/dto/register-customer.dto';

/** Application service for customer registration and customer self-service access. */
@Injectable()
export class CustomerService {
  constructor(
    private readonly customerAccountService: CustomerAccountService,
    private readonly bcryptService: BcryptService,
  ) {}

  /** Creates a new customer account without a global role lookup. */
  /** Registers a customer through the account service and returns a safe projection. */
  async register(dto: RegisterCustomerDto): Promise<SafeCustomerAccount> {
    const passwordHash = await this.bcryptService.hash(dto.password);
    return this.customerAccountService.handleCreate({
      email: dto.email,
      passwordHash,
    });
  }

  /** Returns the authenticated customer profile without exposing credentials. */
  /** Returns the authenticated customer's current safe profile. */
  getCurrent(customerId: string): Promise<SafeCustomerAccount> {
    return this.customerAccountService.findById(customerId);
  }
}
