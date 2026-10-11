import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { MediaModule } from '../../src/modules/media/media.module';
import { S3_CLIENT } from '../../src/modules/media/asset/providers/s3-client.provider';
import { Media } from '../../src/modules/media/asset/entities';
import { CustomerAccount } from '../../src/modules/customer/account/entities/customer-account.entity';
import { ProviderAccount } from '../../src/modules/provider/account/entities/provider-account.entity';
import { ProviderMembership } from '../../src/modules/provider/authorization/entities/provider-membership.entity';
import { ProviderMembershipRole } from '../../src/modules/provider/authorization/entities/provider-membership-role.entity';
import { ProviderRole } from '../../src/modules/provider/authorization/entities/provider-role.entity';
import { ProviderPermission } from '../../src/modules/provider/authorization/entities/provider-permission.entity';
import { ProviderRolePermission } from '../../src/modules/provider/authorization/entities/provider-role-permission.entity';
import { PROVIDER_PERMISSION_REGISTRY } from '../../src/modules/provider/authorization/permissions/provider-permission.registry';
import {
  ProviderStatus,
  ProviderType,
  ProviderVerificationStatus,
} from '../../src/modules/provider/account/enums/account.enums';
import { Estate } from '../../src/modules/estate/property/entities';
import {
  EstatePurpose,
  EstateType,
} from '../../src/modules/estate/property/types/estate.type';
import {
  Province,
  Ward,
  PROVINCE_TYPES,
  WARD_TYPES,
} from '../../src/modules/location/administrative-division/entities/location.entity';

// S3 được giả lập ở SDK boundary; guard, quyền, service và PostgreSQL chạy thật.
describe('Media upload workflow (PostgreSQL)', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let app: INestApplication<Server> | undefined;
  let dataSource: DataSource;
  let estate: Estate;
  let provider: ProviderAccount;
  let membership: ProviderMembership;
  let token: string;
  const secret = 'nexus-media-test-secret';
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP2sAAAAASUVORK5CYII=',
    'base64',
  );
  const send = jest.fn<
    Promise<unknown>,
    [PutObjectCommand | DeleteObjectCommand]
  >();

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_media_test')
      .withUsername('test')
      .withPassword('test')
      .start();
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              CUSTOMER_JWT_ACCESS_SECRET: secret,
              S3_BUCKET: 'estate-images',
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [join(__dirname, '../../src/**/*.entity.ts')],
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: true,
        }),
        MediaModule,
      ],
    })
      .overrideProvider(S3_CLIENT)
      .useValue({ send })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    await app.init();
    dataSource = module.get(DataSource);
  });

  beforeEach(async () => {
    send.mockReset().mockResolvedValue({});
    await dataSource.query(
      'TRUNCATE tbl_customer_account, tbl_provider_role, tbl_provider_permission, tbl_province CASCADE',
    );
    const customer = await dataSource
      .getRepository(CustomerAccount)
      .save({ email: 'media@nexus.test', password: 'unused-in-token-test' });
    provider = await dataSource.getRepository(ProviderAccount).save({
      ownerCustomerId: customer.id,
      displayName: 'Media Provider',
      type: ProviderType.INDIVIDUAL,
      status: ProviderStatus.ACTIVE,
      verificationStatus: ProviderVerificationStatus.VERIFIED,
    });
    membership = await dataSource.getRepository(ProviderMembership).save({
      customerId: customer.id,
      providerId: provider.id,
      status: 'ACTIVE',
    });
    const role = await dataSource
      .getRepository(ProviderRole)
      .save({ code: 'MEDIA_EDITOR', name: 'Media editor' });
    const permission = PROVIDER_PERMISSION_REGISTRY.find(
      (entry) => entry.code === 'property:update',
    );
    if (!permission) throw new Error('Missing property:update registry entry');
    const savedPermission = await dataSource
      .getRepository(ProviderPermission)
      .save(permission);
    await dataSource
      .getRepository(ProviderRolePermission)
      .save({ roleId: role.id, permissionId: savedPermission.id });
    await dataSource
      .getRepository(ProviderMembershipRole)
      .save({ membershipId: membership.id, roleId: role.id });
    const province = await dataSource.getRepository(Province).save({
      code: '79',
      name: 'Ho Chi Minh City',
      type: PROVINCE_TYPES.MUNICIPALITY,
    });
    const ward = await dataSource.getRepository(Ward).save({
      code: '26734',
      name: 'Ben Nghe',
      type: WARD_TYPES.WARD,
      provinceId: province.id,
    });
    estate = await dataSource.getRepository(Estate).save({
      customerId: customer.id,
      providerId: provider.id,
      provinceId: province.id,
      wardId: ward.id,
      title: 'Media test estate',
      type: EstateType.APARTMENT,
      purpose: EstatePurpose.SALE,
      price: 1000000,
      addressLine: '1 Nguyen Hue',
    });
    token = new JwtService().sign(
      {
        sub: customer.id,
        realm: 'customer',
        tokenType: 'access',
        sessionId: randomUUID(),
      },
      { secret },
    );
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  const upload = (accessToken = token, providerId = provider.id) => {
    if (!app) throw new Error('Test app not initialized');
    return request(app.getHttpServer())
      .post(`/estates/${estate.id}/media`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Provider-Id', providerId)
      .attach('file', png, {
        filename: 'renamed.txt',
        contentType: 'image/png',
      });
  };

  it('uploads using S3 API and persists the returned key without audit leakage', async () => {
    const response = await upload().expect(201);
    const body = response.body as {
      data: { id: string; mediaUrl: string; sortOrder: number };
    };
    expect(body.data).toMatchObject({
      estateId: estate.id,
      type: 'image',
      sortOrder: 0,
    });
    expect(body.data).not.toHaveProperty('createdBy');
    expect(body.data).not.toHaveProperty('deletedAt');
    const saved = await dataSource
      .getRepository(Media)
      .findOneByOrFail({ id: body.data.id });
    expect(saved.mediaUrl).toBe(body.data.mediaUrl);
    expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[0][0].input).toMatchObject({
      Key: saved.mediaUrl,
      Body: png,
      ContentType: 'image/png',
    });
  });

  it('serializes concurrent uploads into different sort orders', async () => {
    await Promise.all([upload().expect(201), upload().expect(201)]);
    const images = await dataSource
      .getRepository(Media)
      .find({ where: { estateId: estate.id }, order: { sortOrder: 'ASC' } });
    expect(images.map((image) => image.sortOrder)).toEqual([0, 1]);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('rejects an unauthenticated request before S3', async () => {
    if (!app) throw new Error('Test app not initialized');
    await request(app.getHttpServer())
      .post(`/estates/${estate.id}/media`)
      .expect(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects an Administration token before S3', async () => {
    const adminToken = new JwtService().sign(
      {
        sub: membership.customerId,
        realm: 'administration',
        tokenType: 'access',
        sessionId: randomUUID(),
      },
      { secret },
    );
    await upload(adminToken).expect(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects another Provider resource even for the same legacy customer', async () => {
    const otherCustomer = await dataSource
      .getRepository(CustomerAccount)
      .save({ email: 'other@nexus.test', password: 'unused' });
    const otherProvider = await dataSource.getRepository(ProviderAccount).save({
      ownerCustomerId: otherCustomer.id,
      type: ProviderType.INDIVIDUAL,
      displayName: 'Other provider',
    });
    await dataSource
      .getRepository(Estate)
      .update(estate.id, { providerId: otherProvider.id });
    await upload().expect(403);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not grant access from an arbitrary Provider header', async () => {
    await upload(token, randomUUID()).expect(403);
    expect(send).not.toHaveBeenCalled();
  });

  it('applies permission revocation to the next request', async () => {
    await upload().expect(201);
    send.mockClear();
    await dataSource.getRepository(ProviderRolePermission).clear();
    await upload().expect(403);
    expect(send).not.toHaveBeenCalled();
    expect(await dataSource.getRepository(Media).count()).toBe(1);
  });

  it.each(['membership', 'provider', 'verification'])(
    'rejects invalid %s lifecycle before S3',
    async (state) => {
      if (state === 'membership')
        await dataSource
          .getRepository(ProviderMembership)
          .update(membership.id, { status: 'SUSPENDED' });
      if (state === 'provider')
        await dataSource
          .getRepository(ProviderAccount)
          .update(provider.id, { status: ProviderStatus.SUSPENDED });
      if (state === 'verification')
        await dataSource.getRepository(ProviderAccount).update(provider.id, {
          verificationStatus: ProviderVerificationStatus.UNVERIFIED,
        });
      const response = await upload();
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('rolls back a rejected insert and deletes its uploaded object', async () => {
    await dataSource.query(
      `ALTER TABLE tbl_media ADD CONSTRAINT test_reject_media CHECK (sort_order < 0)`,
    );
    try {
      await upload().expect(500);
      expect(await dataSource.getRepository(Media).count()).toBe(0);
      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
      expect(send.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
      expect(send.mock.calls[1][0].input.Key).toBe(
        send.mock.calls[0][0].input.Key,
      );
    } finally {
      await dataSource.query(
        'ALTER TABLE tbl_media DROP CONSTRAINT test_reject_media',
      );
    }
  });
});
