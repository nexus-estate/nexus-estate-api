import { QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { RbacErrorCodes } from '../../../rbac/errors/rbac-error-codes';
import { RoleService } from '../../../rbac/services/role.service';
import { Role } from '../../../rbac/entities/role.entity';
import { BuyerAccount } from '../models/buyer-account.entity';
import { BuyerAccountErrorCodes } from '../errors/buyer-account-error-codes';
import { BuyerAccountRepository } from '../repositories/buyer-account.repository';
import { BuyerAccountService } from './buyer-account.service';

type BuyerAccountRepositoryMock = {
  findSafeById: jest.MockedFunction<BuyerAccountRepository['findSafeById']>;
  findByEmail: jest.MockedFunction<BuyerAccountRepository['findByEmail']>;
  findByEmailForAuthentication: jest.MockedFunction<
    BuyerAccountRepository['findByEmailForAuthentication']
  >;
  createBuyerAccount: jest.MockedFunction<
    BuyerAccountRepository['createBuyerAccount']
  >;
  updateLastLogin: jest.MockedFunction<
    BuyerAccountRepository['updateLastLogin']
  >;
};

type RoleServiceMock = {
  findById: jest.MockedFunction<RoleService['findById']>;
};

describe('BuyerAccountService', () => {
  let service: BuyerAccountService;
  let buyerAccountRepository: BuyerAccountRepositoryMock;
  let roleService: RoleServiceMock;

  const user = {
    id: 'user-id',
    email: 'buyer@nexus.test',
    roleId: 'role-id',
    isEmailVerified: false,
    lastLogin: null,
  } as BuyerAccount;

  const role = {
    id: 'role-id',
    name: 'buyer',
  } as Role;

  beforeEach(() => {
    buyerAccountRepository = {
      findSafeById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailForAuthentication: jest.fn(),
      createBuyerAccount: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    roleService = {
      findById: jest.fn(),
    };
    service = new BuyerAccountService(
      buyerAccountRepository as unknown as BuyerAccountRepository,
      roleService as unknown as RoleService,
    );
  });

  describe('findById', () => {
    it('returns the user when it exists', async () => {
      buyerAccountRepository.findSafeById.mockResolvedValue(user);

      await expect(service.findById(user.id)).resolves.toBe(user);
      expect(buyerAccountRepository.findSafeById).toHaveBeenCalledWith(user.id);
    });

    it('throws USER_NOT_FOUND when the user does not exist', async () => {
      buyerAccountRepository.findSafeById.mockResolvedValue(null);

      await expect(service.findById('missing-id')).rejects.toMatchObject({
        errorCode: BuyerAccountErrorCodes.BUYER_ACCOUNT_NOT_FOUND.code,
      });
    });
  });

  it('normalizes email for normal lookup', async () => {
    buyerAccountRepository.findByEmail.mockResolvedValue(user);

    await expect(service.findByEmail('  BUYER@NEXUS.TEST  ')).resolves.toBe(
      user,
    );
    expect(buyerAccountRepository.findByEmail).toHaveBeenCalledWith(
      'buyer@nexus.test',
    );
  });

  it('normalizes email for authentication lookup', async () => {
    buyerAccountRepository.findByEmailForAuthentication.mockResolvedValue(user);

    await expect(
      service.findByEmailForAuthentication('  BUYER@NEXUS.TEST  '),
    ).resolves.toBe(user);
    expect(
      buyerAccountRepository.findByEmailForAuthentication,
    ).toHaveBeenCalledWith('buyer@nexus.test');
  });

  describe('create', () => {
    const input = {
      email: '  BUYER@NEXUS.TEST  ',
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
      expect(buyerAccountRepository.findByEmail).not.toHaveBeenCalled();
      expect(buyerAccountRepository.createBuyerAccount).not.toHaveBeenCalled();
    });

    it('does not create a user when the role does not exist', async () => {
      const roleError = new BusinessException(
        RbacErrorCodes.ROLE_NOT_FOUND,
        input.roleId,
      );
      roleService.findById.mockRejectedValue(roleError);

      await expect(service.handleCreate(input)).rejects.toBe(roleError);
      expect(buyerAccountRepository.findByEmail).not.toHaveBeenCalled();
      expect(buyerAccountRepository.createBuyerAccount).not.toHaveBeenCalled();
    });

    it('rejects an existing normalized email without inserting', async () => {
      roleService.findById.mockResolvedValue(role);
      buyerAccountRepository.findByEmail.mockResolvedValue(user);

      await expect(service.handleCreate(input)).rejects.toMatchObject({
        errorCode: BuyerAccountErrorCodes.BUYER_ACCOUNT_EMAIL_EXISTS.code,
      });
      expect(buyerAccountRepository.findByEmail).toHaveBeenCalledWith(
        'buyer@nexus.test',
      );
      expect(buyerAccountRepository.createBuyerAccount).not.toHaveBeenCalled();
    });

    it('persists normalized email with the supplied password hash', async () => {
      roleService.findById.mockResolvedValue(role);
      buyerAccountRepository.findByEmail.mockResolvedValue(null);
      buyerAccountRepository.createBuyerAccount.mockResolvedValue(user);

      await expect(service.handleCreate(input)).resolves.toBe(user);
      expect(buyerAccountRepository.createBuyerAccount).toHaveBeenCalledWith({
        email: 'buyer@nexus.test',
        password: input.passwordHash,
        roleId: input.roleId,
      });
    });

    it('maps PostgreSQL unique violation 23505 to USER_EMAIL_EXISTS', async () => {
      const driverError = Object.assign(new Error('duplicate key'), {
        code: '23505',
      });
      const queryError = new QueryFailedError(
        'INSERT INTO tbl_buyer_account',
        [],
        driverError,
      );
      roleService.findById.mockResolvedValue(role);
      buyerAccountRepository.findByEmail.mockResolvedValue(null);
      buyerAccountRepository.createBuyerAccount.mockRejectedValue(queryError);

      await expect(service.handleCreate(input)).rejects.toMatchObject({
        errorCode: BuyerAccountErrorCodes.BUYER_ACCOUNT_EMAIL_EXISTS.code,
      });
    });

    it('rethrows non-duplicate database errors unchanged', async () => {
      const databaseError = new Error('connection lost');
      roleService.findById.mockResolvedValue(role);
      buyerAccountRepository.findByEmail.mockResolvedValue(null);
      buyerAccountRepository.createBuyerAccount.mockRejectedValue(
        databaseError,
      );

      await expect(service.handleCreate(input)).rejects.toBe(databaseError);
    });
  });

  describe('updateLastLogin', () => {
    const lastLogin = new Date('2026-08-16T00:00:00.000Z');

    it('completes when the repository updates the user', async () => {
      buyerAccountRepository.updateLastLogin.mockResolvedValue(true);

      await expect(service.updateLastLogin(user.id, lastLogin)).resolves.toBe(
        undefined,
      );
      expect(buyerAccountRepository.updateLastLogin).toHaveBeenCalledWith(
        user.id,
        lastLogin,
      );
    });

    it('throws USER_NOT_FOUND when the repository does not update a user', async () => {
      buyerAccountRepository.updateLastLogin.mockResolvedValue(false);

      await expect(
        service.updateLastLogin('missing-id', lastLogin),
      ).rejects.toMatchObject({
        errorCode: BuyerAccountErrorCodes.BUYER_ACCOUNT_NOT_FOUND.code,
      });
    });
  });
});
