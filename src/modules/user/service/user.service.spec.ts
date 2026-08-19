import { QueryFailedError } from 'typeorm';

import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCodes } from '../../../utils/constants/error.constant';
import { RoleService } from '../../rbac/services/role.service';
import { Role } from '../../rbac/entities/role.entity';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { UserService } from './user.service';

type UserRepositoryMock = {
  findById: jest.MockedFunction<UserRepository['findById']>;
  findByEmail: jest.MockedFunction<UserRepository['findByEmail']>;
  findByEmailForAuthentication: jest.MockedFunction<
    UserRepository['findByEmailForAuthentication']
  >;
  create: jest.MockedFunction<UserRepository['create']>;
  updateLastLogin: jest.MockedFunction<UserRepository['updateLastLogin']>;
};

type RoleServiceMock = {
  findById: jest.MockedFunction<RoleService['findById']>;
};

describe('UserService', () => {
  let service: UserService;
  let userRepository: UserRepositoryMock;
  let roleService: RoleServiceMock;

  const user = {
    id: 'user-id',
    email: 'buyer@nexus.test',
    roleId: 'role-id',
    isEmailVerified: false,
    lastLogin: null,
  } as User;

  const role = {
    id: 'role-id',
    name: 'buyer',
  } as Role;

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailForAuthentication: jest.fn(),
      create: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    roleService = {
      findById: jest.fn(),
    };
    service = new UserService(
      userRepository as unknown as UserRepository,
      roleService as unknown as RoleService,
    );
  });

  describe('findById', () => {
    it('returns the user when it exists', async () => {
      userRepository.findById.mockResolvedValue(user);

      await expect(service.findById(user.id)).resolves.toBe(user);
      expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    });

    it('throws USER_NOT_FOUND when the user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.findById('missing-id')).rejects.toMatchObject({
        errorCode: ErrorCodes.USER_NOT_FOUND.code,
      });
    });
  });

  it('normalizes email for normal lookup', async () => {
    userRepository.findByEmail.mockResolvedValue(user);

    await expect(service.findByEmail('  BUYER@NEXUS.TEST  ')).resolves.toBe(
      user,
    );
    expect(userRepository.findByEmail).toHaveBeenCalledWith('buyer@nexus.test');
  });

  it('normalizes email for authentication lookup', async () => {
    userRepository.findByEmailForAuthentication.mockResolvedValue(user);

    await expect(
      service.findByEmailForAuthentication('  BUYER@NEXUS.TEST  '),
    ).resolves.toBe(user);
    expect(userRepository.findByEmailForAuthentication).toHaveBeenCalledWith(
      'buyer@nexus.test',
    );
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
        errorCode: ErrorCodes.VALIDATION_ERROR.code,
      });
      expect(roleService.findById).not.toHaveBeenCalled();
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('does not create a user when the role does not exist', async () => {
      const roleError = new BusinessException(
        ErrorCodes.ROLE_NOT_FOUND,
        input.roleId,
      );
      roleService.findById.mockRejectedValue(roleError);

      await expect(service.handleCreate(input)).rejects.toBe(roleError);
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an existing normalized email without inserting', async () => {
      roleService.findById.mockResolvedValue(role);
      userRepository.findByEmail.mockResolvedValue(user);

      await expect(service.handleCreate(input)).rejects.toMatchObject({
        errorCode: ErrorCodes.USER_EMAIL_EXISTS.code,
      });
      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        'buyer@nexus.test',
      );
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('persists normalized email with the supplied password hash', async () => {
      roleService.findById.mockResolvedValue(role);
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(user);

      await expect(service.handleCreate(input)).resolves.toBe(user);
      expect(userRepository.create).toHaveBeenCalledWith({
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
        'INSERT INTO tbl_user',
        [],
        driverError,
      );
      roleService.findById.mockResolvedValue(role);
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockRejectedValue(queryError);

      await expect(service.handleCreate(input)).rejects.toMatchObject({
        errorCode: ErrorCodes.USER_EMAIL_EXISTS.code,
      });
    });

    it('rethrows non-duplicate database errors unchanged', async () => {
      const databaseError = new Error('connection lost');
      roleService.findById.mockResolvedValue(role);
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockRejectedValue(databaseError);

      await expect(service.handleCreate(input)).rejects.toBe(databaseError);
    });
  });

  describe('updateLastLogin', () => {
    const lastLogin = new Date('2026-08-16T00:00:00.000Z');

    it('completes when the repository updates the user', async () => {
      userRepository.updateLastLogin.mockResolvedValue(true);

      await expect(service.updateLastLogin(user.id, lastLogin)).resolves.toBe(
        undefined,
      );
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith(
        user.id,
        lastLogin,
      );
    });

    it('throws USER_NOT_FOUND when the repository does not update a user', async () => {
      userRepository.updateLastLogin.mockResolvedValue(false);

      await expect(
        service.updateLastLogin('missing-id', lastLogin),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.USER_NOT_FOUND.code,
      });
    });
  });
});
