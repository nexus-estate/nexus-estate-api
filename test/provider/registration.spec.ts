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
import { AdministrationModule } from '../../src/modules/administration/administration.module';
import { AdministratorAccount } from '../../src/modules/administration/authentication/entities/administrator-account.entity';
import { AdministratorRoleAssignment } from '../../src/modules/administration/authorization/entities/administrator-role-assignment.entity';
import { AdministrationPermission } from '../../src/modules/administration/authorization/entities/administration-permission.entity';
import { AdministrationRolePermission } from '../../src/modules/administration/authorization/entities/administration-role-permission.entity';
import { AdministrationRole } from '../../src/modules/administration/authorization/entities/administration-role.entity';
import { ADMINISTRATION_PERMISSIONS } from '../../src/modules/administration/authorization/constants/administration-permission.constant';
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
import { CustomerAccountErrorCodes } from '../../src/modules/customer/account/errors/customer-account-error-codes';
import { BcryptService } from '../../src/common/security/bcrypt.service';
import { PERMISSIONS } from '../../src/utils/constants/permission.constant';
import { ROLES } from '../../src/utils/constants/role.constant';

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
            ProviderMembership,
            ProviderMembershipRole,
            ProviderPermission,
            ProviderRole,
            ProviderRolePermission,
            AdministrationRole,
            AdministrationPermission,
            AdministrationRolePermission,
            AdministratorRoleAssignment,
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
      'TRUNCATE TABLE tbl_provider_account, tbl_customer_account, tbl_administrator_account, tbl_role, tbl_permission, tbl_provider_role, tbl_provider_permission, tbl_administration_role, tbl_administration_permission CASCADE',
    );

    const roles = await dataSource.getRepository(Role).save([
      { name: ROLES.ADMINISTRATOR, isSystem: true },
      { name: ROLES.CUSTOMER, isSystem: true },
      { name: ROLES.PROVIDER, isSystem: true },
    ]);
    await dataSource.getRepository(ProviderRole).save({
      code: 'OWNER',
      name: 'Owner',
      description: 'Provider account owner',
      isSystem: true,
    });
    const administrationRole = await dataSource
      .getRepository(AdministrationRole)
      .save({
        code: 'SUPER_ADMIN',
        name: 'Super administrator',
        description: 'E2E authorization administrator',
        isSystem: true,
      });
    const administrationPermission = await dataSource
      .getRepository(AdministrationPermission)
      .save({
        code: ADMINISTRATION_PERMISSIONS.PROVIDER_ACCOUNT_APPROVE,
        name: 'Approve provider accounts',
        description: 'Approve provider-account onboarding.',
      });
    await dataSource.getRepository(AdministrationRolePermission).save({
      roleId: administrationRole.id,
      permissionId: administrationPermission.id,
    });
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
        roleId: roleByName.get(ROLES.CUSTOMER)!.id,
        permissionId: permissionByName.get(PERMISSIONS.PROVIDER_ACCOUNT_READ)!
          .id,
      },
      {
        roleId: roleByName.get(ROLES.CUSTOMER)!.id,
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
      role: ROLES.CUSTOMER,
      providerAccount: {
        type: 'INDIVIDUAL',
        displayName: 'Independent Provider',
        verificationStatus: 'PENDING',
      },
    });

    const token = await login('provider@nexus.test', 'provider-password');
    await request(app.getHttpServer())
      .get('/api/v1/providers/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rejects duplicate independent-registration email atomically', async () => {
    const registration = {
      email: 'duplicate-provider@nexus.test',
      password: 'provider-password',
      type: 'INDIVIDUAL',
      displayName: 'Duplicate Provider',
    };
    await request(app.getHttpServer())
      .post('/api/v1/providers/register')
      .send(registration)
      .expect(201);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/providers/register')
      .send(registration)
      .expect(409);

    expect((duplicate.body as { code?: string }).code).toBe(
      CustomerAccountErrorCodes.CUSTOMER_ACCOUNT_EMAIL_EXISTS.code,
    );
    await expect(
      dataSource.getRepository(ProviderAccount).count(),
    ).resolves.toBe(1);
  });

  it('keeps customer registration pending until administrator approval', async () => {
    const customerId = await registerCustomer('promoted-customer@nexus.test');
    const customerToken = await login(
      'promoted-customer@nexus.test',
      'customer-password',
    );

    await request(app.getHttpServer())
      .post('/api/v1/providers/register/from-customer')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        customerId: '20000000-0000-4000-8000-000000000099',
        type: 'AGENCY',
        displayName: 'Promoted Agency',
      })
      .expect(400);

    const registrationResponse = await request(app.getHttpServer())
      .post('/api/v1/providers/register/from-customer')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        type: 'AGENCY',
        displayName: 'Promoted Agency',
      })
      .expect(201);
    expect(
      (registrationResponse.body as ApiSuccess<ProviderRegistration>).data,
    ).toMatchObject({
      customerId: customerId,
      role: ROLES.CUSTOMER,
      providerAccount: {
        displayName: 'Promoted Agency',
        verificationStatus: 'PENDING',
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/providers/register/from-customer')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ type: 'AGENCY', displayName: 'Duplicate Agency' })
      .expect(409);

    await request(app.getHttpServer())
      .get('/api/v1/providers/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    const adminRole = await dataSource.getRepository(Role).findOneByOrFail({
      name: ROLES.ADMINISTRATOR,
    });
    const administrator = await dataSource
      .getRepository(AdministratorAccount)
      .save({
        email: 'admin@nexus.test',
        password: await new BcryptService().hash('admin-password'),
        roleId: adminRole.id,
      });
    await dataSource.getRepository(AdministratorRoleAssignment).save({
      administratorId: administrator.id,
      roleId: (
        await dataSource.getRepository(AdministrationRole).findOneByOrFail({
          code: 'SUPER_ADMIN',
        })
      ).id,
      assignedByAdminId: null,
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
      role: ROLES.CUSTOMER,
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
