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

import { CommonModule } from '../src/common/common.module';
import { CustomerModule } from '../src/modules/customer/customer.module';
import { AdministrationModule } from '../src/modules/administration/administration.module';
import { AdministratorAccount } from '../src/modules/administration/models/administrator-account.entity';
import { Permission } from '../src/modules/rbac/entities/permission.entity';
import { RolePermission } from '../src/modules/rbac/entities/role-permission.entity';
import { Role } from '../src/modules/rbac/entities/role.entity';
import { ProviderAccount } from '../src/modules/provider/models/provider-account.entity';
import { ProviderModule } from '../src/modules/provider/provider.module';
import { CustomerAccount } from '../src/modules/customer/models/customer-account.entity';
import { BcryptService } from '../src/common/security/bcrypt.service';
import { PERMISSIONS } from '../src/utils/constants/permission.constant';
import { ROLES } from '../src/utils/constants/role.constant';

type ApiSuccess<T> = { status: true; data: T };
type TokenPair = { accessToken: string; refreshToken: string };
type ProviderRegistration = {
  customerId: string;
  role: string;
  providerAccount: {
    type: string;
    displayName: string;
    verificationStatus: string;
  };
};
type ProviderRegistrationReview = ProviderRegistration & {
  id: string;
  owner: {
    id: string;
    email: string;
    isEmailVerified: boolean;
    role: string;
    lastLogin: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

jest.setTimeout(120_000);

/** Verifies the independent customer and provider onboarding API boundaries. */
describe('Customer and Provider APIs (e2e)', () => {
  let container: StartedPostgreSqlContainer;
  let module: TestingModule | undefined;
  let app: INestApplication<Server>;
  let dataSource: DataSource;

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
          load: [() => ({ JWT_SECRET: 'customer-provider-e2e-secret' })],
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
            AdministratorAccount,
            Role,
            Permission,
            RolePermission,
          ],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        CommonModule,
        CustomerModule,
        ProviderModule,
        ProviderModule,
        AdministrationModule,
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
      'TRUNCATE TABLE tbl_provider_account, tbl_customer_account, tbl_administrator_account, tbl_role, tbl_permission CASCADE',
    );

    const roles = await dataSource.getRepository(Role).save([
      { name: ROLES.ADMINISTRATOR, isSystem: true },
      { name: ROLES.CUSTOMER, isSystem: true },
      { name: ROLES.PROVIDER, isSystem: true },
    ]);
    const permissions = await dataSource
      .getRepository(Permission)
      .save(
        [
          PERMISSIONS.CUSTOMER_PROFILE_READ,
          PERMISSIONS.PROVIDER_ACCOUNT_REGISTER,
          PERMISSIONS.PROVIDER_ACCOUNT_READ,
          PERMISSIONS.PROVIDER_ACCOUNT_UPDATE,
          PERMISSIONS.PROVIDER_ACCOUNT_APPROVE,
        ].map((name) => ({ name })),
      );
    const roleByName = new Map(roles.map((role) => [role.name, role]));
    const permissionByName = new Map(
      permissions.map((permission) => [permission.name, permission]),
    );
    await dataSource.getRepository(RolePermission).save([
      {
        roleId: roleByName.get(ROLES.CUSTOMER)!.id,
        permissionId: permissionByName.get(PERMISSIONS.CUSTOMER_PROFILE_READ)!
          .id,
      },
      {
        roleId: roleByName.get(ROLES.CUSTOMER)!.id,
        permissionId: permissionByName.get(
          PERMISSIONS.PROVIDER_ACCOUNT_REGISTER,
        )!.id,
      },
      {
        roleId: roleByName.get(ROLES.PROVIDER)!.id,
        permissionId: permissionByName.get(PERMISSIONS.PROVIDER_ACCOUNT_READ)!
          .id,
      },
      {
        roleId: roleByName.get(ROLES.PROVIDER)!.id,
        permissionId: permissionByName.get(PERMISSIONS.PROVIDER_ACCOUNT_UPDATE)!
          .id,
      },
      {
        roleId: roleByName.get(ROLES.ADMINISTRATOR)!.id,
        permissionId: permissionByName.get(
          PERMISSIONS.PROVIDER_ACCOUNT_APPROVE,
        )!.id,
      },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  const login = async (email: string, password: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers/auth/login')
      .send({ email, password })
      .expect(201);
    return (response.body as ApiSuccess<TokenPair>).data.accessToken;
  };

  const loginAdministrator = async (
    email: string,
    password: string,
  ): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/administration/auth/login')
      .send({ email, password })
      .expect(201);
    return (response.body as ApiSuccess<TokenPair>).data.accessToken;
  };

  const registerCustomer = async (email: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers/register')
      .send({ email, password: 'customer-password' })
      .expect(201);
    return (response.body as ApiSuccess<{ id: string }>).data.id;
  };

  it('registers a customer and exposes only the customer self-service profile', async () => {
    await registerCustomer('customer@nexus.test');
    const token = await login('customer@nexus.test', 'customer-password');

    const response = await request(app.getHttpServer())
      .get('/api/v1/customers/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = response.body as ApiSuccess<{
      email: string;
      role: { name: string };
    }>;
    expect(body.data).toMatchObject({
      email: 'customer@nexus.test',
      role: { name: ROLES.CUSTOMER },
    });
  });

  it('validates provider onboarding fields and supports independent registration', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/providers/register')
      .send({ email: 'invalid-provider@nexus.test', password: 'short' })
      .expect(400);

    const response = await request(app.getHttpServer())
      .post('/api/v1/providers/register')
      .send({
        email: 'provider@nexus.test',
        password: 'provider-password',
        type: 'INDIVIDUAL',
        displayName: 'Independent Provider',
      })
      .expect(201);
    const body = response.body as ApiSuccess<ProviderRegistration>;

    expect(body.data).toMatchObject({
      role: ROLES.PROVIDER,
      providerAccount: {
        type: 'INDIVIDUAL',
        displayName: 'Independent Provider',
        verificationStatus: 'UNVERIFIED',
      },
    });

    const token = await login('provider@nexus.test', 'provider-password');
    await request(app.getHttpServer())
      .get('/api/v1/providers/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('keeps customerId registration pending until administrator approval', async () => {
    const customerId = await registerCustomer('promoted-customer@nexus.test');
    const customerToken = await login(
      'promoted-customer@nexus.test',
      'customer-password',
    );

    const requestResponse = await request(app.getHttpServer())
      .post('/api/v1/providers/register/from-customer')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        customerId,
        type: 'AGENCY',
        displayName: 'Promoted Agency',
      })
      .expect(201);
    expect(
      (requestResponse.body as ApiSuccess<ProviderRegistration>).data,
    ).toMatchObject({
      customerId: customerId,
      role: ROLES.CUSTOMER,
      providerAccount: {
        displayName: 'Promoted Agency',
        verificationStatus: 'PENDING',
      },
    });

    await request(app.getHttpServer())
      .get('/api/v1/providers/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    const adminRole = await dataSource.getRepository(Role).findOneByOrFail({
      name: ROLES.ADMINISTRATOR,
    });
    await dataSource.getRepository(AdministratorAccount).save({
      email: 'admin@nexus.test',
      password: await new BcryptService().hash('admin-password'),
      roleId: adminRole.id,
    });
    const adminToken = await loginAdministrator(
      'admin@nexus.test',
      'admin-password',
    );

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/administration/provider-registrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const pending = (
      listResponse.body as ApiSuccess<ProviderRegistrationReview[]>
    ).data;
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      owner: {
        id: customerId,
        email: 'promoted-customer@nexus.test',
        role: ROLES.CUSTOMER,
      },
      providerAccount: {
        displayName: 'Promoted Agency',
        verificationStatus: 'PENDING',
      },
    });

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/administration/provider-registrations/${pending[0].id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (detailResponse.body as ApiSuccess<ProviderRegistrationReview>).data.owner
        .id,
    ).toBe(customerId);

    const response = await request(app.getHttpServer())
      .post(
        `/api/v1/administration/provider-registrations/${pending[0].id}/approve`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(
      (response.body as ApiSuccess<ProviderRegistration>).data,
    ).toMatchObject({
      customerId: customerId,
      role: ROLES.PROVIDER,
      providerAccount: {
        displayName: 'Promoted Agency',
        verificationStatus: 'VERIFIED',
      },
    });

    const providerToken = await login(
      'promoted-customer@nexus.test',
      'customer-password',
    );
    await request(app.getHttpServer())
      .get('/api/v1/providers/me')
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);
  });
});
