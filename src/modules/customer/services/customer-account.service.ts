import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../common/errors/common-error-codes';
import { BaseService } from '../../../services/abstraction-services';
import { CustomerAccountErrorCodes } from '../errors/customer-account-error-codes';
import { RoleService } from '../../rbac/services/role.service';
import { CustomerAccountRepository } from '../repositories/customer-account.repository';
import type { CreateCustomerAccountInput } from '../dto/customer-account.dto';
import type {
  CustomerAuthenticationAccount,
  SafeCustomerAccount,
} from '../types/customer-account.type';
import { CustomerAccount } from '../models/customer-account.entity';

/** Coordinates customer-account validation, RBAC assignment, and persistence. */
@Injectable()
export class CustomerAccountService extends BaseService<
  CustomerAccount,
  CustomerAccountCreateData
> {
  constructor(
    private readonly customerAccountRepository: CustomerAccountRepository,
    private readonly roleService: RoleService,
  ) {
    super(customerAccountRepository, 'CustomerAccount');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private prepareEmail(email: string): string {
    const normalizedEmail = this.normalizeEmail(email);

    if (!normalizedEmail) {
      throw new BusinessException(
        CommonErrorCodes.VALIDATION_ERROR,
        'Email is required',
      );
    }

    return normalizedEmail;
  }

  /** Returns a customer account without exposing its password hash. */
  async findById(id: string): Promise<SafeCustomerAccount> {
    const customerAccount =
      await this.customerAccountRepository.findSafeById(id);

    if (!customerAccount) {
      throw new BusinessException(
        CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_NOT_FOUND,
        id,
      );
    }

    return customerAccount;
  }

  /** Finds a customer account by its normalized email address. */
  async findByEmail(email: string): Promise<SafeCustomerAccount | null> {
    const normalizedEmail = this.prepareEmail(email);

    return this.customerAccountRepository.findByEmail(normalizedEmail);
  }

  /** Loads the credential projection required by customer authentication. */
  async findByEmailForAuthentication(
    email: string,
  ): Promise<CustomerAuthenticationAccount | null> {
    const normalizedEmail = this.normalizeEmail(email);

    return this.customerAccountRepository.findByEmailForAuthentication(
      normalizedEmail,
    );
  }

  /** Creates a customer account after validating role and email uniqueness. */
  async handleCreate(
    input: CreateCustomerAccountInput,
  ): Promise<SafeCustomerAccount> {
    const normalizedEmail = this.prepareEmail(input.email);

    if (!normalizedEmail) {
      throw new BusinessException(
        CommonErrorCodes.VALIDATION_ERROR,
        'Email is required',
      );
    }

    await this.roleService.findById(input.roleId);

    const existingCustomerAccount =
      await this.customerAccountRepository.findByEmail(normalizedEmail);

    if (existingCustomerAccount) {
      throw new BusinessException(
        CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_EMAIL_EXISTS,
        normalizedEmail,
      );
    }

    try {
      return await this.customerAccountRepository.createCustomerAccount({
        email: normalizedEmail,
        password: input.passwordHash,
        roleId: input.roleId,
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
        };

        if (driverError.code === '23505') {
          throw new BusinessException(
            CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_EMAIL_EXISTS,
            normalizedEmail,
          );
        }
      }

      throw error;
    }
  }

  /** Stores the latest successful customer authentication timestamp. */
  async updateLastLogin(customerId: string, lastLogin: Date): Promise<void> {
    const updated = await this.customerAccountRepository.updateLastLogin(
      customerId,
      lastLogin,
    );

    if (!updated) {
      throw new BusinessException(
        CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_NOT_FOUND,
        customerId,
      );
    }
  }

  /** Assigns a validated role to an active customer and returns the refreshed account. */
  async updateRole(
    customerId: string,
    roleId: string,
  ): Promise<SafeCustomerAccount> {
    const updated = await this.customerAccountRepository.updateRole(
      customerId,
      roleId,
    );
    if (!updated) {
      throw new BusinessException(
        CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_NOT_FOUND,
        customerId,
      );
    }
    return this.findById(customerId);
  }
}

/** Fields accepted by the inherited generic customer-account create operation. */
type CustomerAccountCreateData = Pick<
  CustomerAccount,
  'email' | 'password' | 'roleId'
>;
