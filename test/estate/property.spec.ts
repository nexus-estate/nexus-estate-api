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
import { AuthSession } from '../../src/common/security/entities/auth-session.entity';
import { LocationModule } from '../../src/modules/location/location.module';
import { CustomerModule } from '../../src/modules/customer/customer.module';
import { Estate } from '../../src/modules/estate/property/entities';
import { EstateModule } from '../../src/modules/estate/estate.module';
import { Lead } from '../../src/modules/lead/lead/entities';
import { LeadModule } from '../../src/modules/lead/lead.module';
import { Listing } from '../../src/modules/listing/listing/entities';
import { ListingModule } from '../../src/modules/listing/listing.module';
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
import { PROVIDER_PERMISSION_REGISTRY } from '../../src/modules/provider/authorization/permissions/provider-permission.registry';
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
  providerId: string;
  title: string;
  provinceId: string;
  wardId: string;
  province: { id: string; code: string; name: string };
  ward: { id: string; code: string; name: string };
  deletedAt: string | null;
  customerId?: unknown;
  customer?: unknown;
  provider?: unknown;
  createdBy?: unknown;
  updatedBy?: unknown;
};

const expectNoLegacyOwnershipLeakage = (estate: EstateResponse): void => {
  expect(estate).not.toHaveProperty('customerId');
  expect(estate).not.toHaveProperty('customer');
  expect(estate).not.toHaveProperty('provider');
  expect(estate).not.toHaveProperty('deletedAt');
  expect(estate).not.toHaveProperty('createdBy');
  expect(estate).not.toHaveProperty('updatedBy');
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
  let ownerProviderId: string;
  let otherProviderId: string;
  let ward: Ward;
  let ownerToken: string;
  let otherToken: string;
  let normalToken: string;

  const expectLocationHydrated = (estate: EstateResponse): void => {
    expect(estate.province).toEqual({
      id: province.id,
      code: province.code,
      name: province.name,
    });
    expect(estate.ward).toEqual({
      id: ward.id,
      code: ward.code,
      name: ward.name,
    });
  };

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

  const revokeOwnerPermission = async (code: string): Promise<void> => {
    await dataSource.query(
      `DELETE FROM tbl_provider_role_permission mapping
       USING tbl_provider_role role, tbl_provider_permission permission,
             tbl_provider_membership membership
       WHERE mapping.role_id = role.id
         AND mapping.permission_id = permission.id
         AND membership.provider_id = $1
         AND membership.customer_id = $2
         AND membership.status = 'ACTIVE'
         AND role.code = 'OWNER'
         AND permission.code = $3`,
      [ownerProviderId, owner.id, code],
    );
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
            Listing,
            Lead,
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
            AuthSession,
          ],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        CommonModule,
        CustomerModule,
        LocationModule,
        EstateModule,
        ListingModule,
        LeadModule,
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
      'TRUNCATE TABLE tbl_lead, tbl_listing, tbl_estate, tbl_provider_account, tbl_customer_account, tbl_role, tbl_provider_role, tbl_provider_permission, tbl_ward, tbl_province CASCADE',
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
    const providers: ProviderAccount[] = await dataSource
      .getRepository(ProviderAccount)
      .save([
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
    ownerProviderId = providers[0].id;
    otherProviderId = providers[1].id;
    const ownerRole = await dataSource
      .getRepository(ProviderRole)
      .findOneByOrFail({
        code: 'OWNER',
      });
    const permissions = await dataSource.getRepository(ProviderPermission).save(
      PROVIDER_PERMISSION_REGISTRY.map((permission) => ({
        code: permission.code,
        name: permission.name,
        description: permission.description,
        category: permission.category,
        resource: permission.resource,
        action: permission.action,
        riskLevel: permission.riskLevel,
        isAssignable: permission.isAssignable,
        deprecatedAt: null,
      })),
    );
    await dataSource.getRepository(ProviderRolePermission).save(
      permissions.map((permission) => ({
        roleId: ownerRole.id,
        permissionId: permission.id,
      })),
    );
    const memberships = await dataSource.getRepository(ProviderMembership).save(
      providers.map((provider) => ({
        providerId: provider.id,
        customerId: provider.ownerCustomerId,
        status: 'ACTIVE' as const,
      })),
    );
    await dataSource.getRepository(ProviderMembershipRole).save(
      memberships.map((membership) => ({
        membershipId: membership.id,
        roleId: ownerRole.id,
      })),
    );
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

  it('creates an authenticated estate owned by the active provider context', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/estates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(estateBody())
      .expect(201);
    const body = response.body as ApiSuccess<EstateResponse>;

    expect(body.status).toBe(true);
    expect(body.data).toMatchObject({
      title: estateBody().title,
      provinceId: province.id,
      wardId: ward.id,
    });
    expect(body.data.providerId).toBe(ownerProviderId);
    expectLocationHydrated(body.data);
    expectNoLegacyOwnershipLeakage(body.data);
  });

  it('returns all eight supply permissions for the OWNER effective authorization', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/providers/me/authorization')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const body = response.body as ApiSuccess<{
      permissions: Array<{ code: string }>;
    }>;

    expect(body.data.permissions.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'property:read',
        'property:create',
        'property:update',
        'property:archive',
        'listing:read',
        'listing:create',
        'listing:publish',
        'listing:archive',
      ]),
    );
  });

  it('lists wards for a selected province without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/locations/provinces/${province.id}/wards`)
      .expect(200);
    const body = response.body as ApiSuccess<Ward[]>;

    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: ward.id,
      provinceId: province.id,
      name: ward.name,
    });
  });

  it('rejects a malformed province id for the wards route', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/locations/provinces/not-a-uuid/wards')
      .expect(400);

    expect(response.body).toMatchObject({ status: false, statusCode: 400 });
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

  it('rejects the next property mutation after its permission is revoked', async () => {
    const created = await createEstate();
    await revokeOwnerPermission('property:update');

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/estates/${created.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Permission revoked' })
      .expect(403);

    expect((response.body as ApiError).code).toBe(
      ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
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

  it('lists only estates belonging to the resolved provider context', async () => {
    const created = await createEstate();
    await dataSource.getRepository(Estate).save({
      ...estateBody(),
      id: undefined,
      customerId: otherUser.id,
      providerId: otherProviderId,
      title: 'Other provider estate',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/estates/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const body = response.body as ApiSuccess<EstateResponse[]>;

    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(created.id);
    expect(body.data[0].providerId).toBe(ownerProviderId);
    expectLocationHydrated(body.data[0]);
    expectNoLegacyOwnershipLeakage(body.data[0]);
  });

  it('gets an estate by id without exposing legacy ownership', async () => {
    const created = await createEstate();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/estates/${created.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const body = response.body as ApiSuccess<EstateResponse>;

    expect(body.data).toMatchObject({ id: created.id });
    expect(body.data.providerId).toBe(ownerProviderId);
    expectLocationHydrated(body.data);
    expectNoLegacyOwnershipLeakage(body.data);
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
    expectLocationHydrated(body.data);
    expectNoLegacyOwnershipLeakage(body.data);
  });

  it('does not make property:update depend on property:read', async () => {
    const created = await createEstate();
    await revokeOwnerPermission('property:read');

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/estates/${created.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Updated without read permission' })
      .expect(200);

    expect((response.body as ApiSuccess<EstateResponse>).data.title).toBe(
      'Updated without read permission',
    );
  });

  it('loads provider-owned edit detail with property:update only', async () => {
    const created = await createEstate();
    await revokeOwnerPermission('property:read');

    const response = await request(app.getHttpServer())
      .get(`/api/v1/estates/${created.id}/mine`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect((response.body as ApiSuccess<EstateResponse>).data.id).toBe(
      created.id,
    );
  });

  it('forbids another provider from updating an estate', async () => {
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

  it('forbids another provider from deleting an estate', async () => {
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

  it('completes the estate, listing, publication, and public lead flow', async () => {
    const estate = await createEstate();
    const draftResponse = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ estateId: estate.id })
      .expect(201);
    const draft = (
      draftResponse.body as ApiSuccess<{
        id: string;
        estateId: string;
        status: string;
      }>
    ).data;

    expect(draft).toMatchObject({
      estateId: estate.id,
      status: 'DRAFT',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/listings/${draft.id}/archive`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(409);

    const publishedResponse = await request(app.getHttpServer())
      .post(`/api/v1/listings/${draft.id}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    expect(
      (publishedResponse.body as ApiSuccess<{ status: string }>).data.status,
    ).toBe('PUBLISHED');

    await request(app.getHttpServer())
      .delete(`/api/v1/estates/${estate.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/listings/${draft.id}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(409);

    const marketplaceResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/listings?type=${EstateType.APARTMENT}&provinceId=${province.id}`,
      )
      .expect(200);
    const marketplace = marketplaceResponse.body as ApiSuccess<{
      items: Array<{ id: string; estateId: string }>;
    }>;
    expect(marketplace.data.items).toEqual([
      expect.objectContaining({ id: draft.id, estateId: estate.id }),
    ]);

    await request(app.getHttpServer())
      .get(`/api/v1/listings/${draft.id}`)
      .expect(200);

    const leadResponse = await request(app.getHttpServer())
      .post(`/api/v1/listings/${draft.id}/leads`)
      .send({
        name: 'Jane Doe',
        phone: '0900000000',
        email: 'jane@example.com',
        message: 'Please call me',
      })
      .expect(201);
    expect(
      (leadResponse.body as ApiSuccess<{ listingId: string; status: string }>)
        .data,
    ).toMatchObject({ listingId: draft.id, status: 'NEW' });

    const archivedResponse = await request(app.getHttpServer())
      .post(`/api/v1/listings/${draft.id}/archive`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    expect(
      (archivedResponse.body as ApiSuccess<{ status: string }>).data.status,
    ).toBe('ARCHIVED');
    await request(app.getHttpServer())
      .get(`/api/v1/listings/${draft.id}`)
      .expect(404);
    const afterArchive = await request(app.getHttpServer())
      .get(
        `/api/v1/listings?type=${EstateType.APARTMENT}&provinceId=${province.id}`,
      )
      .expect(200);
    expect(
      (afterArchive.body as ApiSuccess<{ items: unknown[] }>).data.items,
    ).toHaveLength(0);

    await request(app.getHttpServer())
      .delete(`/api/v1/estates/${estate.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const mineAfterArchive = await request(app.getHttpServer())
      .get('/api/v1/estates/mine')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect((mineAfterArchive.body as ApiSuccess<unknown[]>).data).toHaveLength(
      0,
    );
  });

  it('enforces listing:create independently from the OWNER role name', async () => {
    const estate = await createEstate();
    await revokeOwnerPermission('listing:create');

    const response = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ estateId: estate.id })
      .expect(403);

    expect((response.body as ApiError).code).toBe(
      ProviderAccountErrorCodes.PROVIDER_ACCOUNT_FORBIDDEN.code,
    );
  });

  it('does not make listing:create depend on listing:read', async () => {
    const estate = await createEstate();
    await revokeOwnerPermission('listing:read');

    const response = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ estateId: estate.id })
      .expect(201);

    expect((response.body as ApiSuccess<{ status: string }>).data.status).toBe(
      'DRAFT',
    );
  });
});
