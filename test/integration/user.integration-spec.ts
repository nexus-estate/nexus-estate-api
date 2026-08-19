import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource, QueryFailedError } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { Permission } from '../../src/modules/rbac/entities/permission.entity';
import { RolePermission } from '../../src/modules/rbac/entities/role-permission.entity';
import { Role } from '../../src/modules/rbac/entities/role.entity';
import { User } from '../../src/modules/user/entities/user.entity';
import { UserRepository } from '../../src/modules/user/repositories/user.repository';
import { UserService } from '../../src/modules/user/service/user.service';
import { UserModule } from '../../src/modules/user/user.module';

jest.setTimeout(120_000);

describe('UserModule (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let module: TestingModule | undefined;
  let dataSource: DataSource;
  let userRepository: UserRepository;
  let userService: UserService;
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
          entities: [User, Role, Permission, RolePermission],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        UserModule,
      ],
    }).compile();

    dataSource = module.get(DataSource);
    userRepository = module.get(UserRepository);
    userService = module.get(UserService);
    role = await dataSource.getRepository(Role).save({ name: 'buyer' });
  });

  afterAll(async () => {
    await module?.close();
    await container?.stop();
  });

  it('resolves UserService with its RBAC dependency', () => {
    expect(userService).toBeDefined();
  });

  it('keeps password out of ordinary lookups and includes it for authentication', async () => {
    const email = 'buyer@nexus.test';
    const passwordHash = '$2b$10$test-password-hash';
    const created = await userService.handleCreate({
      email,
      passwordHash,
      roleId: role.id,
    });

    const normalLookup = await userService.findByEmail(
      `  ${email.toUpperCase()}  `,
    );
    const authenticationLookup =
      await userService.findByEmailForAuthentication(email);

    expect(created.email).toBe(email);
    expect(normalLookup).not.toBeNull();
    expect(normalLookup).not.toHaveProperty('password');
    expect(normalLookup?.role.name).toBe('buyer');
    expect(authenticationLookup?.password).toBe(passwordHash);
    expect(authenticationLookup?.role.name).toBe('buyer');
  });

  it('enforces the database unique email constraint', async () => {
    await expect(
      userRepository.create({
        email: 'buyer@nexus.test',
        password: '$2b$10$another-password-hash',
        roleId: role.id,
      }),
    ).rejects.toBeInstanceOf(QueryFailedError);
  });

  it('updates lastLogin without changing role or email', async () => {
    const user = await userService.findByEmail('buyer@nexus.test');
    const lastLogin = new Date('2026-08-16T00:00:00.000Z');

    await userService.updateLastLogin(user!.id, lastLogin);

    const [row] = await dataSource.query<
      {
        email: string;
        role_id: string;
        last_login: Date;
      }[]
    >('SELECT email, role_id, last_login FROM tbl_user WHERE id = $1', [
      user!.id,
    ]);
    expect(row).toMatchObject({ email: user!.email, role_id: user!.roleId });
    expect(new Date(row.last_login).toISOString()).toBe(
      lastLogin.toISOString(),
    );
  });
});
