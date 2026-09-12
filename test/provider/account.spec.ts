import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Server } from 'node:http';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { CommonModule } from '../../src/common/common.module';
import { CustomerModule } from '../../src/modules/customer/customer.module';
import { Permission } from '../../src/modules/rbac/legacy-global/entities/permission.entity';
import { RolePermission } from '../../src/modules/rbac/legacy-global/entities/role-permission.entity';
import { Role } from '../../src/modules/rbac/legacy-global/entities/role.entity';
import { ProviderAccount } from '../../src/modules/provider/account/entities/provider-account.entity';
import { ProviderMembership } from '../../src/modules/provider/authorization/entities/provider-membership.entity';
import { ProviderMembershipRole } from '../../src/modules/provider/authorization/entities/provider-membership-role.entity';
import { ProviderPermission } from '../../src/modules/provider/authorization/entities/provider-permission.entity';
import { ProviderRole } from '../../src/modules/provider/authorization/entities/provider-role.entity';
import { ProviderRolePermission } from '../../src/modules/provider/authorization/entities/provider-role-permission.entity';
import { ProviderModule } from '../../src/modules/provider/provider.module';
import { CustomerAccount } from '../../src/modules/customer/account/entities/customer-account.entity';
import { ProviderAccountErrorCodes } from '../../src/modules/provider/account/errors/provider-account-error-codes';
import { PERMISSIONS } from '../../src/utils/constants/permission.constant';

type ApiSuccess<T> = { status: true; data: T };
type ApiError = { status: false; code?: string; message: string };
type ProviderResponse = {
  id: string;
  type: string;
  displayName: string;
  status: string;
  verificationStatus: string;
};
type TokenPair = { accessToken: string; refreshToken: string };

jest.setTimeout(120_000);

describe('ProviderAccount API (e2e)', () => {
  let container: StartedPostgreSqlContainer;
  let module: TestingModule | undefined;
  let app: INestApplication<Server>;
  let dataSource: DataSource;

  const email = 'provider@nexus.test';
  const password = 'correct-password';

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
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: 'provider-e2e-secret' })],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [
            ProviderAccount,
            CustomerAccount,
            Role,
            Permission,
            RolePermission,
            ProviderMembership,
            ProviderMembershipRole,
            ProviderPermission,
            ProviderRole,
            ProviderRolePermission,
          ],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        CommonModule,
        CustomerModule,
        ProviderModule,
      ],
    }).compile();

    app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    dataSource = module.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE tbl_provider_account, tbl_customer_account, tbl_role, tbl_permission, tbl_provider_role, tbl_provider_permission CASCADE',
    );
    const customerRole = await dataSource.getRepository(Role).save({
      name: 'customer',
      isSystem: true,
    });
    await dataSource.getRepository(ProviderRole).save({
      code: 'OWNER',
      name: 'Owner',
      description: 'Provider account owner',
      isSystem: true,
    });
    const permissions = await dataSource
      .getRepository(Permission)
      .save(
        [
          PERMISSIONS.PROVIDER_ACCOUNT_REGISTER,
          PERMISSIONS.PROVIDER_ACCOUNT_READ,
          PERMISSIONS.PROVIDER_ACCOUNT_UPDATE,
        ].map((name) => ({ name })),
      );
    await dataSource.getRepository(RolePermission).save(
      permissions.map((permission) => ({
        roleId: customerRole.id,
        permissionId: permission.id,
      })),
    );
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  const registerAndLogin = async (): Promise<string> => {
    await request(app.getHttpServer())
      .post('/api/v1/customers/register')
      .send({ email, password })
      .expect(201);
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers/auth/login')
      .send({ email, password })
      .expect(201);
    return (response.body as ApiSuccess<TokenPair>).data.accessToken;
  };

  it('completes register, create, get, and profile update for the current user', async () => {
    const token = await registerAndLogin();

    await request(app.getHttpServer())
      .get('/api/v1/provider/account')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    const created = await request(app.getHttpServer())
      .post('/api/v1/provider/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'INDIVIDUAL', displayName: 'Nguyen Van A' })
      .expect(201);
    const createdBody = created.body as ApiSuccess<ProviderResponse>;
    expect(createdBody.data).toMatchObject({
      type: 'INDIVIDUAL',
      displayName: 'Nguyen Van A',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    });

    const fetched = await request(app.getHttpServer())
      .get('/api/v1/provider/account')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((fetched.body as ApiSuccess<ProviderResponse>).data.id).toBe(
      createdBody.data.id,
    );

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/provider/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Updated Provider' })
      .expect(200);
    expect(
      (updated.body as ApiSuccess<ProviderResponse>).data.displayName,
    ).toBe('Updated Provider');
  });

  it('requires authentication and protects server-controlled fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/provider/account')
      .send({ type: 'INDIVIDUAL', displayName: 'Anonymous' })
      .expect(401);

    const token = await registerAndLogin();
    await request(app.getHttpServer())
      .post('/api/v1/provider/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'INDIVIDUAL', displayName: 'Provider' })
      .expect(201);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/provider/account')
      .set('Authorization', `Bearer ${token}`)
      .set('x-lang', 'vi-VN')
      .send({ type: 'INDIVIDUAL', displayName: 'Duplicate' })
      .expect(409);
    expect((duplicate.body as ApiError).code).toBe(
      ProviderAccountErrorCodes.PROVIDER_ACCOUNT_ALREADY_EXISTS.code,
    );
    expect((duplicate.body as ApiError).message).toBe(
      'Tài khoản của bạn đã tồn tại.',
    );
    expect(duplicate.headers['content-language']).toBe('vi');

    const injection = await request(app.getHttpServer())
      .patch('/api/v1/provider/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Provider', status: 'SUSPENDED' })
      .expect(400);
    expect((injection.body as ApiError).message).toContain(
      'property status should not exist',
    );
  });
});
