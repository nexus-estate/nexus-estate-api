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
import { Estate } from '../../src/modules/estate/property/entities';
import { EstateModule } from '../../src/modules/estate/estate.module';
import {
  EstatePurpose,
  EstateType,
} from '../../src/modules/estate/property/types/estate.type';
import {
  PROVINCE_TYPES,
  Province,
  WARD_TYPES,
  Ward,
} from '../../src/modules/location/administrative-division/entities/location.entity';
import { Permission } from '../../src/modules/rbac/legacy-global/entities/permission.entity';
import { RolePermission } from '../../src/modules/rbac/legacy-global/entities/role-permission.entity';
import { Role } from '../../src/modules/rbac/legacy-global/entities/role.entity';
import { CustomerAccount } from '../../src/modules/customer/account/entities/customer-account.entity';
import { CommonErrorCodes } from '../../src/common/errors/common-error-codes';
import { BcryptService } from '../../src/common/security/bcrypt.service';
import { ProviderAccount } from '../../src/modules/provider/account/entities/provider-account.entity';
import { ProviderMembership } from '../../src/modules/provider/authorization/entities/provider-membership.entity';
import { ProviderMembershipRole } from '../../src/modules/provider/authorization/entities/provider-membership-role.entity';
import { ProviderPermission } from '../../src/modules/provider/authorization/entities/provider-permission.entity';
import { ProviderRole } from '../../src/modules/provider/authorization/entities/provider-role.entity';
import { ProviderRolePermission } from '../../src/modules/provider/authorization/entities/provider-role-permission.entity';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../../src/modules/provider/account/enums/account.enums';
import { ProviderAccountErrorCodes } from '../../src/modules/provider/account/errors/provider-account-error-codes';

type ApiSuccess<T> = {
  status: true;
  data: T;
  timestamp: string;
  path: string;
};

type ApiError = {
  status: false;
  statusCode: number;
  code?: string;
  message: string;
  path: string;
};

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

type EstateResponse = {
  id: string;
  customerId: string;
  title: string;
  provinceId: string;
  wardId: string;
  deletedAt: string | null;
};

describe('Estate API (e2e)', () => {
  let container: StartedPostgreSqlContainer;
  let module: TestingModule | undefined;
  let app: INestApplication<Server>;
  let dataSource: DataSource;
  let owner: CustomerAccount;
  let otherUser: CustomerAccount;
  let normalUser: CustomerAccount;
  let province: Province;
  let ward: Ward;
  let ownerToken: string;
  let otherToken: string;
  let normalToken: string;

  const password = 'correct-password';

  const estateBody = () => ({
    title: 'Riverside apartment',
    description: 'River view',
    type: EstateType.APARTMENT,
    purpose: EstatePurpose.SALE,
    price: 3_500_000_000,
    area: 82.5,
    bedrooms: 2,
    bathrooms: 2,
    floors: 20,
    addressLine: '1 Nguyen Hue',
    provinceId: province.id,
    wardId: ward.id,
    latitude: 10.7769,
    longitude: 106.7009,
  });

  const login = async (email: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers/auth/login')
      .send({ email, password })
      .expect(201);
    const body = response.body as ApiSuccess<TokenPair>;
    return body.data.accessToken;
  };

  const createEstate = async (): Promise<EstateResponse> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/estates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(estateBody())
      .expect(201);
    return (response.body as ApiSuccess<EstateResponse>).data;
  };

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
          load: [() => ({ JWT_SECRET: 'estate-e2e-secret' })],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [
            Estate,
            CustomerAccount,
            ProviderAccount,
            Role,
            Permission,
            RolePermission,
            ProviderMembership,
            ProviderMembershipRole,
            ProviderPermission,
            ProviderRole,
            ProviderRolePermission,
            Province,
            Ward,
          ],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        CommonModule,
        CustomerModule,
        EstateModule,
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
      'TRUNCATE TABLE tbl_estate, tbl_provider_account, tbl_customer_account, tbl_role, tbl_provider_role, tbl_provider_permission, tbl_ward, tbl_province CASCADE',
    );

    const role = await dataSource.getRepository(Role).save({
      name: 'customer',
      description: null,
      isSystem: true,
    });
    await dataSource.getRepository(ProviderRole).save({
      code: 'OWNER',
      name: 'Owner',
      description: 'Provider account owner',
      isSystem: true,
    });
    const passwordHash = await new BcryptService().hash(password);
    owner = await dataSource.getRepository(CustomerAccount).save({
      email: 'owner@nexus.test',
      password: passwordHash,
      roleId: role.id,
    });
    otherUser = await dataSource.getRepository(CustomerAccount).save({
      email: 'other@nexus.test',
      password: passwordHash,
      roleId: role.id,
    });
    normalUser = await dataSource.getRepository(CustomerAccount).save({
      email: 'normal@nexus.test',
      password: passwordHash,
      roleId: role.id,
    });
    await dataSource.getRepository(ProviderAccount).save([
      {
        ownerCustomerId: owner.id,
        type: ProviderType.INDIVIDUAL,
        displayName: 'Owner Provider',
        status: ProviderStatus.ACTIVE,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      },
      {
        ownerCustomerId: otherUser.id,
        type: ProviderType.INDIVIDUAL,
        displayName: 'Other Provider',
        status: ProviderStatus.ACTIVE,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      },
    ]);
    province = await dataSource.getRepository(Province).save({
      code: '79',
      name: 'Ho Chi Minh City',
      type: PROVINCE_TYPES.MUNICIPALITY,
    });
    ward = await dataSource.getRepository(Ward).save({
      code: '26734',
      name: 'Ben Nghe',
      type: WARD_TYPES.WARD,
      provinceId: province.id,
    });
    ownerToken = await login(owner.email);
    otherToken = await login(otherUser.email);
    normalToken = await login(normalUser.email);
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('creates an authenticated estate using the principal user id', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/estates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(estateBody())
      .expect(201);
    const body = response.body as ApiSuccess<EstateResponse>;

    expect(body.status).toBe(true);
    expect(body.data).toMatchObject({
      customerId: owner.id,
      title: estateBody().title,
      provinceId: province.id,
      wardId: ward.id,
    });
  });

  it('rejects a normal customer without a provider account', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/estates')
      .set('Authorization', `Bearer ${normalToken}`)
      .send(estateBody())
      .expect(404);

    expect((response.body as ApiError).code).toBe(
      ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_FOUND.code,
    );
  });

  it.each([
    ProviderVerificationStatus.PENDING,
    ProviderVerificationStatus.UNVERIFIED,
    ProviderVerificationStatus.REJECTED,
  ])(
    'rejects an owner provider with verification status %s',
    async (verificationStatus) => {
      await dataSource
        .getRepository(ProviderAccount)
        .update({ ownerCustomerId: owner.id }, { verificationStatus });

      const response = await request(app.getHttpServer())
        .post('/api/v1/estates')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(estateBody())
        .expect(403);

      expect((response.body as ApiError).code).toBe(
        ProviderAccountErrorCodes.PROVIDER_ACCOUNT_NOT_VERIFIED.code,
      );
    },
  );

  it('rejects a suspended provider from creating an estate', async () => {
    await dataSource
      .getRepository(ProviderAccount)
      .update(
        { ownerCustomerId: owner.id },
        { status: ProviderStatus.SUSPENDED },
      );

    const response = await request(app.getHttpServer())
      .post('/api/v1/estates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(estateBody())
      .expect(403);

    expect((response.body as ApiError).code).toBe(
      ProviderAccountErrorCodes.PROVIDER_ACCOUNT_SUSPENDED.code,
    );
  });

  it('rejects request fields that are not declared by CreateEstateDto', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/estates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...estateBody(), customerId: otherUser.id })
      .expect(400);
    const body = response.body as ApiError;

    expect(body).toMatchObject({ status: false, statusCode: 400 });
    expect(body.message).toContain('property customerId should not exist');
  });

  it('lists only estates belonging to the authenticated principal', async () => {
    const created = await createEstate();
    await dataSource.getRepository(Estate).save({
      ...estateBody(),
      id: undefined,
      customerId: otherUser.id,
      title: 'Other owner estate',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/estates/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const body = response.body as ApiSuccess<EstateResponse[]>;

    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(created.id);
  });

  it('gets an estate by id', async () => {
    const created = await createEstate();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/estates/${created.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const body = response.body as ApiSuccess<EstateResponse>;

    expect(body.data).toMatchObject({ id: created.id, customerId: owner.id });
  });

  it('allows the owner to update an estate', async () => {
    const created = await createEstate();

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/estates/${created.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Updated title' })
      .expect(200);
    const body = response.body as ApiSuccess<EstateResponse>;

    expect(body.data).toMatchObject({
      id: created.id,
      title: 'Updated title',
    });
  });

  it('forbids a non-owner from updating an estate', async () => {
    const created = await createEstate();

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/estates/${created.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Unauthorized update' })
      .expect(403);
    const body = response.body as ApiError;

    expect(body.code).toBe(CommonErrorCodes.FORBIDDEN.code);
  });

  it('does not allow a verified provider to update another customer estate', async () => {
    const otherEstate = await request(app.getHttpServer())
      .post('/api/v1/estates')
      .set('Authorization', `Bearer ${otherToken}`)
      .send(estateBody())
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(
        `/api/v1/estates/${(otherEstate.body as ApiSuccess<EstateResponse>).data.id}`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Unauthorized update' })
      .expect(403);

    expect((response.body as ApiError).code).toBe(
      CommonErrorCodes.FORBIDDEN.code,
    );
  });

  it('allows the owner to soft-delete an estate', async () => {
    const created = await createEstate();

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/estates/${created.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect((response.body as ApiSuccess<boolean>).data).toBe(true);
    await expect(
      dataSource.getRepository(Estate).findOneBy({ id: created.id }),
    ).resolves.toBeNull();
  });

  it('forbids a non-owner from deleting an estate', async () => {
    const created = await createEstate();

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/estates/${created.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
    const body = response.body as ApiError;

    expect(body.code).toBe(CommonErrorCodes.FORBIDDEN.code);
  });

  it('does not allow a verified provider to delete another customer estate', async () => {
    const otherEstate = await request(app.getHttpServer())
      .post('/api/v1/estates')
      .set('Authorization', `Bearer ${otherToken}`)
      .send(estateBody())
      .expect(201);

    const response = await request(app.getHttpServer())
      .delete(
        `/api/v1/estates/${(otherEstate.body as ApiSuccess<EstateResponse>).data.id}`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);

    expect((response.body as ApiError).code).toBe(
      CommonErrorCodes.FORBIDDEN.code,
    );
  });

  it('rejects an unauthenticated estate request', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/estates/mine')
      .expect(401);
    const body = response.body as ApiError;

    expect(body).toMatchObject({ status: false, statusCode: 401 });
  });
});
