import { QueryFailedError } from 'typeorm';

import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { CustomerAccount } from '../entities/customer-account.entity';
import { CustomerAccountErrorCodes } from '../errors/customer-account-error-codes';
import { CustomerAccountRepository } from '../repositories/customer-account.repository';
import { CustomerAccountService } from './customer-account.service';

type CustomerAccountRepositoryMock = {
  findSafeById: jest.MockedFunction<CustomerAccountRepository['findSafeById']>;
  findByEmail: jest.MockedFunction<CustomerAccountRepository['findByEmail']>;
  findByEmailForAuthentication: jest.MockedFunction<
    CustomerAccountRepository['findByEmailForAuthentication']
  >;
  createCustomerAccount: jest.MockedFunction<
    CustomerAccountRepository['createCustomerAccount']
  >;
  updateLastLogin: jest.MockedFunction<
    CustomerAccountRepository['updateLastLogin']
  >;
};

describe('CustomerAccountService', () => {
  let service: CustomerAccountService;
  let customerAccountRepository: CustomerAccountRepositoryMock;

  const user = {
    id: 'user-id',
    email: 'customer@nexus.test',
    isEmailVerified: false,
    lastLogin: null,
  } as CustomerAccount;

  beforeEach(() => {
    customerAccountRepository = {
      findSafeById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailForAuthentication: jest.fn(),
      createCustomerAccount: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    service = new CustomerAccountService(
      customerAccountRepository as unknown as CustomerAccountRepository,
    );
  });

  describe('findById', () => {
    it('returns the user when it exists', async () => {
      customerAccountRepository.findSafeById.mockResolvedValue(user);

      await expect(service.findById(user.id)).resolves.toBe(user);
      expect(customerAccountRepository.findSafeById).toHaveBeenCalledWith(
        user.id,
      );
    });

    it('throws CUSTOMER_ACCOUNT_NOT_FOUND when the user does not exist', async () => {
      customerAccountRepository.findSafeById.mockResolvedValue(null);

      await expect(service.findById('missing-id')).rejects.toMatchObject({
        errorCode: CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_NOT_FOUND.code,
      });
    });
  });

  it('normalizes email for normal lookup', async () => {
    customerAccountRepository.findByEmail.mockResolvedValue(user);

    await expect(service.findByEmail('  CUSTOMER@NEXUS.TEST  ')).resolves.toBe(
      user,
    );
    expect(customerAccountRepository.findByEmail).toHaveBeenCalledWith(
      'customer@nexus.test',
    );
  });

  it('normalizes email for authentication lookup', async () => {
    customerAccountRepository.findByEmailForAuthentication.mockResolvedValue(
      user,
    );

    await expect(
      service.findByEmailForAuthentication('  CUSTOMER@NEXUS.TEST  '),
    ).resolves.toBe(user);
    expect(
      customerAccountRepository.findByEmailForAuthentication,
    ).toHaveBeenCalledWith('customer@nexus.test');
  });

  describe('handleCreate', () => {
    const input = {
      email: '  CUSTOMER@NEXUS.TEST  ',
      passwordHash: '$2b$10$hashed-password',
    };

    it('rejects an empty normalized email without querying persistence', async () => {
      await expect(
        service.handleCreate({ ...input, email: '   ' }),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.VALIDATION_ERROR.code,
      });
      expect(customerAccountRepository.findByEmail).not.toHaveBeenCalled();
      expect(
        customerAccountRepository.createCustomerAccount,
      ).not.toHaveBeenCalled();
    });

    it('rejects an existing normalized email without inserting', async () => {
      customerAccountRepository.findByEmail.mockResolvedValue(user);

      await expect(service.handleCreate(input)).rejects.toMatchObject({
        errorCode: CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_EMAIL_EXISTS.code,
      });
      expect(customerAccountRepository.findByEmail).toHaveBeenCalledWith(
        'customer@nexus.test',
      );
      expect(
        customerAccountRepository.createCustomerAccount,
      ).not.toHaveBeenCalled();
    });

    it('persists normalized email with the supplied password hash', async () => {
      customerAccountRepository.findByEmail.mockResolvedValue(null);
      customerAccountRepository.createCustomerAccount.mockResolvedValue(user);

      await expect(service.handleCreate(input)).resolves.toBe(user);
      expect(
        customerAccountRepository.createCustomerAccount,
      ).toHaveBeenCalledWith({
        email: 'customer@nexus.test',
        password: input.passwordHash,
      });
    });

    it('maps PostgreSQL unique violation 23505 to CUSTOMER_ACCOUNT_EMAIL_EXISTS', async () => {
      const driverError = Object.assign(new Error('duplicate key'), {
        code: '23505',
      });
      const queryError = new QueryFailedError(
        'INSERT INTO tbl_customer_account',
        [],
        driverError,
      );
      customerAccountRepository.findByEmail.mockResolvedValue(null);
      customerAccountRepository.createCustomerAccount.mockRejectedValue(
        queryError,
      );

      await expect(service.handleCreate(input)).rejects.toMatchObject({
        errorCode: CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_EMAIL_EXISTS.code,
      });
    });

    it('rethrows non-duplicate database errors unchanged', async () => {
      const databaseError = new Error('connection lost');
      customerAccountRepository.findByEmail.mockResolvedValue(null);
      customerAccountRepository.createCustomerAccount.mockRejectedValue(
        databaseError,
      );

      await expect(service.handleCreate(input)).rejects.toBe(databaseError);
    });
  });

  describe('updateLastLogin', () => {
    const lastLogin = new Date('2026-08-16T00:00:00.000Z');

    it('completes when the repository updates the user', async () => {
      customerAccountRepository.updateLastLogin.mockResolvedValue(true);

      await expect(service.updateLastLogin(user.id, lastLogin)).resolves.toBe(
        undefined,
      );
      expect(customerAccountRepository.updateLastLogin).toHaveBeenCalledWith(
        user.id,
        lastLogin,
      );
    });

    it('throws CUSTOMER_ACCOUNT_NOT_FOUND when the repository does not update a user', async () => {
      customerAccountRepository.updateLastLogin.mockResolvedValue(false);

      await expect(
        service.updateLastLogin('missing-id', lastLogin),
      ).rejects.toMatchObject({
        errorCode: CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_NOT_FOUND.code,
      });
    });
  });
});
