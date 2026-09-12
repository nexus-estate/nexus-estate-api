import { QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { RbacErrorCodes } from '../../../rbac/legacy-global/errors/rbac-error-codes';
import { RoleService } from '../../../rbac/legacy-global/services/role.service';
import { Role } from '../../../rbac/legacy-global/entities/role.entity';
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

type RoleServiceMock = {
  findById: jest.MockedFunction<RoleService['findById']>;
};

describe('CustomerAccountService', () => {
  let service: CustomerAccountService;
  let customerAccountRepository: CustomerAccountRepositoryMock;
  let roleService: RoleServiceMock;

  const user = {
    id: 'user-id',
    email: 'customer@nexus.test',
    roleId: 'role-id',
    isEmailVerified: false,
    lastLogin: null,
  } as CustomerAccount;

  const role = {
    id: 'role-id',
    name: 'customer',
  } as Role;

  beforeEach(() => {
    customerAccountRepository = {
      findSafeById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailForAuthentication: jest.fn(),
      createCustomerAccount: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    roleService = {
      findById: jest.fn(),
    };
    service = new CustomerAccountService(
      customerAccountRepository as unknown as CustomerAccountRepository,
      roleService,
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

    it('throws USER_NOT_FOUND when the user does not exist', async () => {
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

  describe('create', () => {
    const input = {
      email: '  CUSTOMER@NEXUS.TEST  ',
      passwordHash: '$2b$10$hashed-password',
      roleId: role.id,
    };

    it('rejects an empty normalized email without querying dependencies', async () => {
      await expect(
        service.handleCreate({ ...input, email: '   ' }),
      ).rejects.toMatchObject({
        errorCode: CommonErrorCodes.VALIDATION_ERROR.code,
      });
      expect(roleService.findById).not.toHaveBeenCalled();
      expect(customerAccountRepository.findByEmail).not.toHaveBeenCalled();
      expect(
        customerAccountRepository.createCustomerAccount,
      ).not.toHaveBeenCalled();
    });

    it('does not create a user when the role does not exist', async () => {
      const roleError = new BusinessException(
        RbacErrorCodes.ROLE_NOT_FOUND,
        input.roleId,
      );
      roleService.findById.mockRejectedValue(roleError);

      await expect(service.handleCreate(input)).rejects.toBe(roleError);
      expect(customerAccountRepository.findByEmail).not.toHaveBeenCalled();
      expect(
        customerAccountRepository.createCustomerAccount,
      ).not.toHaveBeenCalled();
    });

    it('rejects an existing normalized email without inserting', async () => {
      roleService.findById.mockResolvedValue(role);
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
      roleService.findById.mockResolvedValue(role);
      customerAccountRepository.findByEmail.mockResolvedValue(null);
      customerAccountRepository.createCustomerAccount.mockResolvedValue(user);

      await expect(service.handleCreate(input)).resolves.toBe(user);
      expect(
        customerAccountRepository.createCustomerAccount,
      ).toHaveBeenCalledWith({
        email: 'customer@nexus.test',
        password: input.passwordHash,
        roleId: input.roleId,
      });
    });

    it('maps PostgreSQL unique violation 23505 to USER_EMAIL_EXISTS', async () => {
      const driverError = Object.assign(new Error('duplicate key'), {
        code: '23505',
      });
      const queryError = new QueryFailedError(
        'INSERT INTO tbl_customer_account',
        [],
        driverError,
      );
      roleService.findById.mockResolvedValue(role);
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
      roleService.findById.mockResolvedValue(role);
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

    it('throws USER_NOT_FOUND when the repository does not update a user', async () => {
      customerAccountRepository.updateLastLogin.mockResolvedValue(false);

      await expect(
        service.updateLastLogin('missing-id', lastLogin),
      ).rejects.toMatchObject({
        errorCode: CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_NOT_FOUND.code,
      });
    });
  });
});
