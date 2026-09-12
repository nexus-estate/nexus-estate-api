import { PermissionService } from './permission.service';
import { PermissionRepository } from '../repositories/permission.repository';
import { Permission } from '../entities/permission.entity';
import { CommonErrorCodes } from '../../../common/errors/common-error-codes';
import { RbacErrorCodes } from '../errors/rbac-error-codes';
import { QueryFailedError } from 'typeorm';

type PermissionRepositoryMock = {
  findById: jest.MockedFunction<PermissionRepository['findById']>;
  findByName: jest.MockedFunction<PermissionRepository['findByName']>;
  create: jest.MockedFunction<PermissionRepository['create']>;
};

describe('PermissionService', () => {
  let service: PermissionService;
  let permissionRepository: PermissionRepositoryMock;

  const permission = {
    id: 'permission-id',
    name: 'listing:create',
    description: null,
  } as Permission;

  beforeEach(() => {
    permissionRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
    };

    service = new PermissionService(
      permissionRepository as unknown as PermissionRepository,
    );
  });

  describe('findById', () => {
    it('returns the permission when it exists', async () => {
      permissionRepository.findById.mockResolvedValue(permission);

      await expect(service.findById(permission.id)).resolves.toBe(permission);
      expect(permissionRepository.findById).toHaveBeenCalledWith(permission.id);
    });

    it('throws PERMISSION_NOT_FOUND when it does not exist', async () => {
      permissionRepository.findById.mockResolvedValue(null);

      await expect(service.findById('missing-id')).rejects.toMatchObject({
        errorCode: RbacErrorCodes.PERMISSION_NOT_FOUND.code,
      });
    });
  });

  describe('findByName', () => {
    it('normalizes the name before querying the repository', async () => {
      permissionRepository.findByName.mockResolvedValue(permission);

      await expect(service.findByName('  LISTING:CREATE  ')).resolves.toBe(
        permission,
      );
      expect(permissionRepository.findByName).toHaveBeenCalledWith(
        'listing:create',
      );
    });
  });

  describe('create', () => {
    it('rejects an empty normalized name without querying the repository', async () => {
      await expect(service.create({ name: '   ' })).rejects.toMatchObject({
        errorCode: CommonErrorCodes.VALIDATION_ERROR.code,
      });
      expect(permissionRepository.findByName).not.toHaveBeenCalled();
      expect(permissionRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an existing permission without inserting it', async () => {
      permissionRepository.findByName.mockResolvedValue(permission);

      await expect(
        service.create({ name: '  LISTING:CREATE  ' }),
      ).rejects.toMatchObject({
        errorCode: RbacErrorCodes.PERMISSION_EXISTS.code,
      });
      expect(permissionRepository.findByName).toHaveBeenCalledWith(
        'listing:create',
      );
      expect(permissionRepository.create).not.toHaveBeenCalled();
    });

    it('normalizes and persists a new permission', async () => {
      permissionRepository.findByName.mockResolvedValue(null);
      permissionRepository.create.mockResolvedValue(permission);

      await expect(
        service.create({ name: '  LISTING:CREATE  ' }),
      ).resolves.toBe(permission);
      expect(permissionRepository.create).toHaveBeenCalledWith(
        'listing:create',
        null,
      );
    });

    it('maps PostgreSQL unique violation 23505 to PERMISSION_EXISTS', async () => {
      const driverError = Object.assign(new Error('duplicate key'), {
        code: '23505',
      });
      const queryError = new QueryFailedError(
        'INSERT INTO tbl_permission',
        [],
        driverError,
      );
      permissionRepository.findByName.mockResolvedValue(null);
      permissionRepository.create.mockRejectedValue(queryError);

      await expect(
        service.create({ name: 'listing:create' }),
      ).rejects.toMatchObject({
        errorCode: RbacErrorCodes.PERMISSION_EXISTS.code,
      });
    });

    it('rethrows non-duplicate database errors unchanged', async () => {
      const databaseError = new Error('connection lost');
      permissionRepository.findByName.mockResolvedValue(null);
      permissionRepository.create.mockRejectedValue(databaseError);

      await expect(service.create({ name: 'listing:create' })).rejects.toBe(
        databaseError,
      );
    });
  });
});
