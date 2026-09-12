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
import { Permission } from '../src/modules/rbac/entities/permission.entity';
import { RolePermission } from '../src/modules/rbac/entities/role-permission.entity';
import { Role } from '../src/modules/rbac/entities/role.entity';
import { SellerAccount } from '../src/modules/seller-platform/seller-account/entity';
import { SellerPlatformModule } from '../src/modules/seller-platform/seller-platform.module';
import { User } from '../src/modules/user/entities/user.entity';
import { ErrorCodes } from '../src/utils/constants/error.constant';

type ApiSuccess<T> = { status: true; data: T };
type ApiError = { status: false; code?: string; message: string };
type SellerResponse = {
  id: string;
  type: string;
  displayName: string;
  status: string;
  verificationStatus: string;
};
type TokenPair = { accessToken: string; refreshToken: string };

jest.setTimeout(120_000);

describe('SellerAccount API (e2e)', () => {
  let container: StartedPostgreSqlContainer;
  let module: TestingModule | undefined;
  let app: INestApplication<Server>;
  let dataSource: DataSource;

  const email = 'seller@nexus.test';
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
          load: [() => ({ JWT_SECRET: 'seller-e2e-secret' })],
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
      'TRUNCATE TABLE tbl_seller_account, tbl_user, tbl_role CASCADE',
    );
    await dataSource.getRepository(Role).save({
      name: 'BUYER',
      isSystem: true,
    });
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  const registerAndLogin = async (): Promise<string> => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    return (response.body as ApiSuccess<TokenPair>).data.accessToken;
  };

  it('completes register, create, get, and profile update for the current user', async () => {
    const token = await registerAndLogin();

    await request(app.getHttpServer())
      .get('/api/v1/seller/account')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    const created = await request(app.getHttpServer())
      .post('/api/v1/seller/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'INDIVIDUAL', displayName: 'Nguyen Van A' })
      .expect(201);
    const createdBody = created.body as ApiSuccess<SellerResponse>;
    expect(createdBody.data).toMatchObject({
      type: 'INDIVIDUAL',
      displayName: 'Nguyen Van A',
      status: 'ACTIVE',
      verificationStatus: 'UNVERIFIED',
    });

    const fetched = await request(app.getHttpServer())
      .get('/api/v1/seller/account')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((fetched.body as ApiSuccess<SellerResponse>).data.id).toBe(
      createdBody.data.id,
    );

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/seller/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Updated Seller' })
      .expect(200);
    expect((updated.body as ApiSuccess<SellerResponse>).data.displayName).toBe(
      'Updated Seller',
    );
  });

  it('requires authentication and protects server-controlled fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/seller/account')
      .send({ type: 'INDIVIDUAL', displayName: 'Anonymous' })
      .expect(401);

    const token = await registerAndLogin();
    await request(app.getHttpServer())
      .post('/api/v1/seller/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'INDIVIDUAL', displayName: 'Seller' })
      .expect(201);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/seller/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'INDIVIDUAL', displayName: 'Duplicate' })
      .expect(409);
    expect((duplicate.body as ApiError).code).toBe(
      ErrorCodes.SELLER_ACCOUNT_ALREADY_EXISTS.code,
    );

    const injection = await request(app.getHttpServer())
      .patch('/api/v1/seller/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Seller', status: 'SUSPENDED' })
      .expect(400);
    expect((injection.body as ApiError).message).toContain(
      'property status should not exist',
    );
  });
});
