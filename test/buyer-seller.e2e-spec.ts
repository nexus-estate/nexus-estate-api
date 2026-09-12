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
import { AuthModule } from '../src/modules/auth/auth.module';
import { BuyerModule } from '../src/modules/buyer/buyer.module';
import { SellerModule } from '../src/modules/seller/seller.module';
import { Permission } from '../src/modules/rbac/entities/permission.entity';
import { RolePermission } from '../src/modules/rbac/entities/role-permission.entity';
import { Role } from '../src/modules/rbac/entities/role.entity';
import { SellerAccount } from '../src/modules/seller-platform/account/models/account.entity';
import { SellerPlatformModule } from '../src/modules/seller-platform/seller-platform.module';
import { User } from '../src/modules/user/entities/user.entity';
import { HashHelper } from '../src/utils/helpers/hash.helper';
import { PERMISSIONS } from '../src/utils/constants/permission.constant';
import { ROLES } from '../src/utils/constants/role.constant';

type ApiSuccess<T> = { status: true; data: T };
type TokenPair = { accessToken: string; refreshToken: string };
type SellerRegistration = {
  userId: string;
  role: string;
  sellerAccount: {
    type: string;
    displayName: string;
    verificationStatus: string;
  };
};
type SellerRegistrationReview = SellerRegistration & {
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

/** Verifies the independent buyer and seller onboarding API boundaries. */
describe('Buyer and Seller APIs (e2e)', () => {
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
          load: [() => ({ JWT_SECRET: 'buyer-seller-e2e-secret' })],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [SellerAccount, User, Role, Permission, RolePermission],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        CommonModule,
        AuthModule,
        BuyerModule,
        SellerModule,
        SellerPlatformModule,
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
      'TRUNCATE TABLE tbl_seller_account, tbl_user, tbl_role, tbl_permission CASCADE',
    );

    const roles = await dataSource.getRepository(Role).save([
      { name: ROLES.ADMINISTRATOR, isSystem: true },
      { name: ROLES.BUYER, isSystem: true },
      { name: ROLES.SELLER, isSystem: true },
    ]);
    const permissions = await dataSource
      .getRepository(Permission)
      .save(
        [
          PERMISSIONS.BUYER_PROFILE_READ,
          PERMISSIONS.SELLER_ACCOUNT_REGISTER,
          PERMISSIONS.SELLER_ACCOUNT_READ,
          PERMISSIONS.SELLER_ACCOUNT_UPDATE,
          PERMISSIONS.SELLER_ACCOUNT_APPROVE,
        ].map((name) => ({ name })),
      );
    const roleByName = new Map(roles.map((role) => [role.name, role]));
    const permissionByName = new Map(
      permissions.map((permission) => [permission.name, permission]),
    );
    await dataSource.getRepository(RolePermission).save([
      {
        roleId: roleByName.get(ROLES.BUYER)!.id,
        permissionId: permissionByName.get(PERMISSIONS.BUYER_PROFILE_READ)!.id,
      },
      {
        roleId: roleByName.get(ROLES.BUYER)!.id,
        permissionId: permissionByName.get(PERMISSIONS.SELLER_ACCOUNT_REGISTER)!
          .id,
      },
      {
        roleId: roleByName.get(ROLES.SELLER)!.id,
        permissionId: permissionByName.get(PERMISSIONS.SELLER_ACCOUNT_READ)!.id,
      },
      {
        roleId: roleByName.get(ROLES.SELLER)!.id,
        permissionId: permissionByName.get(PERMISSIONS.SELLER_ACCOUNT_UPDATE)!
          .id,
      },
      {
        roleId: roleByName.get(ROLES.ADMINISTRATOR)!.id,
        permissionId: permissionByName.get(PERMISSIONS.SELLER_ACCOUNT_APPROVE)!
          .id,
      },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  const login = async (email: string, password: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    return (response.body as ApiSuccess<TokenPair>).data.accessToken;
  };

  const registerBuyer = async (email: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/buyers/register')
      .send({ email, password: 'buyer-password' })
      .expect(201);
    return (response.body as ApiSuccess<{ id: string }>).data.id;
  };

  it('registers a buyer and exposes only the buyer self-service profile', async () => {
    await registerBuyer('buyer@nexus.test');
    const token = await login('buyer@nexus.test', 'buyer-password');

    const response = await request(app.getHttpServer())
      .get('/api/v1/buyers/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = response.body as ApiSuccess<{
      email: string;
      role: { name: string };
    }>;
    expect(body.data).toMatchObject({
      email: 'buyer@nexus.test',
      role: { name: ROLES.BUYER },
    });
  });

  it('validates seller onboarding fields and supports independent registration', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sellers/register')
      .send({ email: 'invalid-seller@nexus.test', password: 'short' })
      .expect(400);

    const response = await request(app.getHttpServer())
      .post('/api/v1/sellers/register')
      .send({
        email: 'seller@nexus.test',
        password: 'seller-password',
        type: 'INDIVIDUAL',
        displayName: 'Independent Seller',
      })
      .expect(201);
    const body = response.body as ApiSuccess<SellerRegistration>;

    expect(body.data).toMatchObject({
      role: ROLES.SELLER,
      sellerAccount: {
        type: 'INDIVIDUAL',
        displayName: 'Independent Seller',
        verificationStatus: 'UNVERIFIED',
      },
    });

    const token = await login('seller@nexus.test', 'seller-password');
    await request(app.getHttpServer())
      .get('/api/v1/sellers/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('keeps buyerId registration pending until administrator approval', async () => {
    const buyerId = await registerBuyer('promoted-buyer@nexus.test');
    const buyerToken = await login(
      'promoted-buyer@nexus.test',
      'buyer-password',
    );

    const requestResponse = await request(app.getHttpServer())
      .post('/api/v1/sellers/register/from-buyer')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        buyerId,
        type: 'AGENCY',
        displayName: 'Promoted Agency',
      })
      .expect(201);
    expect(
      (requestResponse.body as ApiSuccess<SellerRegistration>).data,
    ).toMatchObject({
      userId: buyerId,
      role: ROLES.BUYER,
      sellerAccount: {
        displayName: 'Promoted Agency',
        verificationStatus: 'PENDING',
      },
    });

    await request(app.getHttpServer())
      .get('/api/v1/sellers/me')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(403);

    const adminRole = await dataSource.getRepository(Role).findOneByOrFail({
      name: ROLES.ADMINISTRATOR,
    });
    await dataSource.getRepository(User).save({
      email: 'admin@nexus.test',
      password: await HashHelper.hash('admin-password'),
      roleId: adminRole.id,
    });
    const adminToken = await login('admin@nexus.test', 'admin-password');

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/seller-registrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const pending = (
      listResponse.body as ApiSuccess<SellerRegistrationReview[]>
    ).data;
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      owner: {
        id: buyerId,
        email: 'promoted-buyer@nexus.test',
        role: ROLES.BUYER,
      },
      sellerAccount: {
        displayName: 'Promoted Agency',
        verificationStatus: 'PENDING',
      },
    });

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/admin/seller-registrations/${pending[0].id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (detailResponse.body as ApiSuccess<SellerRegistrationReview>).data.owner
        .id,
    ).toBe(buyerId);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/admin/seller-registrations/${pending[0].id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(
      (response.body as ApiSuccess<SellerRegistration>).data,
    ).toMatchObject({
      userId: buyerId,
      role: ROLES.SELLER,
      sellerAccount: {
        displayName: 'Promoted Agency',
        verificationStatus: 'VERIFIED',
      },
    });

    const sellerToken = await login(
      'promoted-buyer@nexus.test',
      'buyer-password',
    );
    await request(app.getHttpServer())
      .get('/api/v1/sellers/me')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
  });
});
