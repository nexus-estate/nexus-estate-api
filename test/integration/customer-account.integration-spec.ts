import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource, QueryFailedError } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { Permission } from '../../src/modules/rbac/legacy-global/entities/permission.entity';
import { RolePermission } from '../../src/modules/rbac/legacy-global/entities/role-permission.entity';
import { Role } from '../../src/modules/rbac/legacy-global/entities/role.entity';
import { CustomerAccount } from '../../src/modules/customer/account/entities/customer-account.entity';
import { CustomerAccountRepository } from '../../src/modules/customer/account/repositories/customer-account.repository';
import { CustomerAccountService } from '../../src/modules/customer/account/services/customer-account.service';
import { CustomerModule } from '../../src/modules/customer/customer.module';

jest.setTimeout(120_000);

describe('Customer account (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let module: TestingModule | undefined;
  let dataSource: DataSource;
  let userRepository: CustomerAccountRepository;
  let userService: CustomerAccountService;
  let role: Role;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ JWT_SECRET: 'customer-integration-secret' })],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [CustomerAccount, Role, Permission, RolePermission],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        CustomerModule,
      ],
    }).compile();

    dataSource = module.get(DataSource);
    userRepository = module.get(CustomerAccountRepository);
    userService = module.get(CustomerAccountService);
    role = await dataSource.getRepository(Role).save({ name: 'customer' });
  });

  afterAll(async () => {
    await module?.close();
    await container?.stop();
  });

  it('resolves CustomerAccountService with its RBAC dependency', () => {
    expect(userService).toBeDefined();
  });

  it('keeps password out of ordinary lookups and includes it for authentication', async () => {
    const email = 'customer@nexus.test';
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
    expect(normalLookup?.role.name).toBe('customer');
    expect(authenticationLookup?.password).toBe(passwordHash);
    expect(authenticationLookup?.role.name).toBe('customer');
  });

  it('enforces the database unique email constraint', async () => {
    await expect(
      userRepository.create({
        email: 'customer@nexus.test',
        password: '$2b$10$another-password-hash',
        roleId: role.id,
      }),
    ).rejects.toBeInstanceOf(QueryFailedError);
  });

  it('updates lastLogin without changing role or email', async () => {
    const user = await userService.findByEmail('customer@nexus.test');
    const lastLogin = new Date('2026-08-16T00:00:00.000Z');

    await userService.updateLastLogin(user!.id, lastLogin);

    const [row] = await dataSource.query<
      {
        email: string;
        role_id: string;
        last_login: Date;
      }[]
    >(
      'SELECT email, role_id, last_login FROM tbl_customer_account WHERE id = $1',
      [user!.id],
    );
    expect(row).toMatchObject({ email: user!.email, role_id: user!.roleId });
    expect(new Date(row.last_login).toISOString()).toBe(
      lastLogin.toISOString(),
    );
  });
});
