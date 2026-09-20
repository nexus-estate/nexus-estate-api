import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { CustomerAccountErrorCodes } from '../errors/customer-account-error-codes';
import { CustomerAccountRepository } from '../repositories/customer-account.repository';
import type { CreateCustomerAccountInput } from '../dto/customer-account.dto';
import type {
  CustomerAuthenticationAccount,
  SafeCustomerAccount,
} from '../types/customer-account.type';

/**
 * Coordinates customer-account validation and persistence. Customer creation
 * never depends on global RBAC; the legacy `role_id` column is read only as
 * persistence compatibility and is not part of the registration contract.
 */
@Injectable()
export class CustomerAccountService {
  constructor(
    private readonly customerAccountRepository: CustomerAccountRepository,
  ) {}

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

  /** Returns a safe customer projection by exact identifier without exposing credentials. */
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

  /** Finds a safe customer projection by normalized email for public account flows. */
  async findByEmail(email: string): Promise<SafeCustomerAccount | null> {
    const normalizedEmail = this.prepareEmail(email);

    return this.customerAccountRepository.findByEmail(normalizedEmail);
  }

  /** Loads the password-bearing authentication projection for credential verification only. */
  async findByEmailForAuthentication(
    email: string,
  ): Promise<CustomerAuthenticationAccount | null> {
    const normalizedEmail = this.normalizeEmail(email);

    return this.customerAccountRepository.findByEmailForAuthentication(
      normalizedEmail,
    );
  }

  /** Creates a customer account and translates persistence conflicts to stable business errors. */
  async handleCreate(
    input: CreateCustomerAccountInput,
  ): Promise<SafeCustomerAccount> {
    const normalizedEmail = this.prepareEmail(input.email);

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

  /** Records the latest successful login without changing customer authorization state. */
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
}
