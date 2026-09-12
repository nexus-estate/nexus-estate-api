import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { Permission } from '../../src/modules/rbac/legacy-global/entities/permission.entity';
import { RolePermission } from '../../src/modules/rbac/legacy-global/entities/role-permission.entity';
import { Role } from '../../src/modules/rbac/legacy-global/entities/role.entity';
import { RbacModule } from '../../src/modules/rbac/rbac.module';
import { PermissionService } from '../../src/modules/rbac/legacy-global/services/permission.service';
import { RoleService } from '../../src/modules/rbac/legacy-global/services/role.service';
import { RbacErrorCodes } from '../../src/modules/rbac/legacy-global/errors/rbac-error-codes';

describe('RbacModule (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let module: TestingModule | undefined;
  let dataSource: DataSource;
  let permissionService: PermissionService;
  let roleService: RoleService;
  let role: Role;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [Role, Permission, RolePermission],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        RbacModule,
      ],
    }).compile();

    dataSource = module.get(DataSource);
    permissionService = module.get(PermissionService);
    roleService = module.get(RoleService);
    role = await dataSource.getRepository(Role).save({
      name: 'admin',
      description: 'System administrator',
      isSystem: true,
    });
  });

  afterAll(async () => {
    await module?.close();
    await container?.stop();
  });

  it('resolves the production RBAC services', () => {
    expect(permissionService).toBeDefined();
    expect(roleService).toBeDefined();
  });

  it('creates normalized permissions and assigns them through RolePermission', async () => {
    const createPermission = await permissionService.create({
      name: '  LISTING:CREATE  ',
      description: 'Create listings',
    });
    const readPermission = await permissionService.create({
      name: 'listing:read',
    });

    const updatedRole = await roleService.replacePermissions(role.id, [
      createPermission.id,
      readPermission.id,
      readPermission.id,
    ]);

    expect(createPermission.name).toBe('listing:create');
    expect(updatedRole.rolePermissions).toHaveLength(2);
    expect(
      updatedRole.rolePermissions.map(({ permission }) => permission.name),
    ).toEqual(expect.arrayContaining(['listing:create', 'listing:read']));
  });

  it('rejects missing permissions without replacing existing assignments', async () => {
    await expect(
      roleService.replacePermissions(role.id, [
        '00000000-0000-0000-0000-000000000000',
      ]),
    ).rejects.toMatchObject({
      errorCode: RbacErrorCodes.PERMISSION_NOT_FOUND.code,
    });

    const unchangedRole = await roleService.findByIdWithPermissions(role.id);
    expect(unchangedRole.rolePermissions).toHaveLength(2);
  });
});
