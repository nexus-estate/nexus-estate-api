import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { CommonErrorCodes } from '../../src/common/errors/common-error-codes';
import type { SuccessResponse } from '../../src/common/interceptors/transform.interceptor';
import type { MediaResponse } from '../../src/modules/media/asset/dto/media.response';
import { MediaModule } from '../../src/modules/media/media.module';
import { S3_CLIENT } from '../../src/modules/media/asset/providers/s3-client.provider';
import { ObjectStorageService } from '../../src/modules/media/asset/services/object-storage.service';
import { Media, MediaType } from '../../src/modules/media/asset/entities';
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
    [PutObjectCommand | DeleteObjectCommand | GetObjectCommand]
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

  describe('Owned estate media (property:read)', () => {
    beforeEach(async () => {
      const permission = PROVIDER_PERMISSION_REGISTRY.find(
        (entry) => entry.code === 'property:read',
      );
      if (!permission) throw new Error('Missing property:read registry entry');
      // Grant read only: the listing must not require property:update.
      await dataSource.getRepository(ProviderRolePermission).clear();
      const savedPermission = await dataSource
        .getRepository(ProviderPermission)
        .save(permission);
      const assignedRole = await dataSource
        .getRepository(ProviderMembershipRole)
        .findOneByOrFail({ membershipId: membership.id });
      await dataSource.getRepository(ProviderRolePermission).save({
        roleId: assignedRole.roleId,
        permissionId: savedPermission.id,
      });
    });

    const list = (
      id = estate.id,
      selectedProvider?: string,
      authenticated = true,
    ) => {
      if (!app) throw new Error('Test app not initialized');
      const call = request(app.getHttpServer()).get(
        `/estates/${id}/media/mine`,
      );
      if (authenticated) call.set('Authorization', `Bearer ${token}`);
      if (selectedProvider) call.set('X-Provider-Id', selectedProvider);
      return call;
    };

    const saveImage = (sortOrder = 0, createdAt = new Date()) =>
      dataSource.getRepository(Media).save({
        estateId: estate.id,
        mediaUrl: `estates/${estate.id}/${randomUUID()}.png`,
        type: MediaType.IMAGE,
        sortOrder,
        createdAt,
        createdBy: membership.customerId,
        caption: 'internal caption',
      });

    describe('GET /estates/:estateId/media/:mediaId/content/mine', () => {
      let image: Media;
      let readStorage: jest.SpiedFunction<
        ObjectStorageService['readEstateImage']
      >;
      const jpeg = Buffer.from(
        'ffd8ffe000104a46494600010100000100010000ffd9',
        'hex',
      );

      beforeEach(async () => {
        image = await saveImage();
        if (!app) throw new Error('Test app not initialized');
        readStorage = jest.spyOn(
          app.get(ObjectStorageService),
          'readEstateImage',
        );
        send.mockResolvedValue({
          Body: { transformToByteArray: () => Promise.resolve(png) },
          ContentType: 'image/png',
        });
      });

      afterEach(() => {
        readStorage?.mockRestore();
      });

      const read = (
        id = estate.id,
        mediaId = image.id,
        selectedProvider?: string,
        accessToken: string | null = token,
      ) => {
        if (!app) throw new Error('Test app not initialized');
        const call = request(app.getHttpServer()).get(
          `/estates/${id}/media/${mediaId}/content/mine`,
        );
        if (accessToken) call.set('Authorization', `Bearer ${accessToken}`);
        if (selectedProvider) call.set('X-Provider-Id', selectedProvider);
        return call;
      };

      it.each([
        { mimetype: 'image/png', buffer: png, explicit: false },
        { mimetype: 'image/png', buffer: png, explicit: true },
        { mimetype: 'image/jpeg', buffer: jpeg, explicit: false },
        { mimetype: 'image/jpeg', buffer: jpeg, explicit: true },
      ] as const)(
        'reads exact $mimetype bytes from a DRAFT with read-only permission and Provider header $explicit',
        async ({ mimetype, buffer, explicit }) => {
          expect(estate.status).toBe('DRAFT');
          send.mockResolvedValue({
            Body: { transformToByteArray: () => Promise.resolve(buffer) },
            ContentType: mimetype,
          });
          const response = await read(
            estate.id,
            image.id,
            explicit ? provider.id : undefined,
          ).expect(200);
          expect(response.headers['content-type']).toBe(mimetype);
          expect(response.body).toEqual(buffer);
          expect(readStorage).toHaveBeenCalledTimes(1);
          expect(readStorage).toHaveBeenCalledWith(image.mediaUrl);
          expect(send).toHaveBeenCalledTimes(1);
          expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
          expect(send.mock.calls[0][0].input).toEqual({
            Bucket: 'estate-images',
            Key: image.mediaUrl,
          });
        },
      );

      it.each([
        ['X-Content-Type-Options', 'nosniff'],
        ['Cache-Control', 'no-store'],
      ])('sets %s: %s', async (header, value) => {
        await read().expect(200).expect(header, value);
      });

      it('rejects unauthenticated access before object storage', async () => {
        await read(estate.id, image.id, undefined, null).expect(401);
        expect(readStorage).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
      });

      it('rejects an Administration token before object storage', async () => {
        const adminToken = new JwtService().sign(
          {
            sub: membership.customerId,
            realm: 'administration',
            tokenType: 'access',
            sessionId: randomUUID(),
          },
          { secret },
        );
        await read(estate.id, image.id, undefined, adminToken).expect(401);
        expect(readStorage).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
      });

      it('enforces read permission revocation on the next request before object storage', async () => {
        await read().expect(200);
        readStorage.mockClear();
        send.mockClear();
        await dataSource.getRepository(ProviderRolePermission).clear();
        await read().expect(403);
        expect(readStorage).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
      });

      it('rejects another Provider estate despite matching legacy customerId or a forged header', async () => {
        const otherCustomer = await dataSource
          .getRepository(CustomerAccount)
          .save({ email: 'read-other@nexus.test', password: 'unused' });
        const other = await dataSource.getRepository(ProviderAccount).save({
          ownerCustomerId: otherCustomer.id,
          displayName: 'Other image Provider',
          type: ProviderType.INDIVIDUAL,
          status: ProviderStatus.ACTIVE,
          verificationStatus: ProviderVerificationStatus.VERIFIED,
        });
        await dataSource
          .getRepository(Estate)
          .update(estate.id, { providerId: other.id });
        await read(estate.id, image.id, provider.id).expect(403);
        await read(estate.id, image.id, other.id).expect(403);
        expect(readStorage).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
      });

      it.each(['missing', 'deleted', 'other-estate', 'video'])(
        'returns not found for %s media without reading object storage',
        async (state) => {
          let mediaId = image.id;
          if (state === 'missing') mediaId = randomUUID();
          if (state === 'deleted')
            await dataSource.getRepository(Media).softDelete(image.id);
          if (state === 'video') {
            await dataSource
              .getRepository(Media)
              .update(image.id, { type: MediaType.VIDEO });
          }
          if (state === 'other-estate') {
            const otherEstate = await dataSource.getRepository(Estate).save({
              ...estate,
              id: randomUUID(),
              title: 'Another estate owned by the same Provider',
            });
            await dataSource
              .getRepository(Media)
              .update(image.id, { estateId: otherEstate.id });
          }
          const response = await read(estate.id, mediaId).expect(404);
          expect(response.body).toMatchObject({
            status: false,
            code: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
          });
          expect(readStorage).not.toHaveBeenCalled();
          expect(send).not.toHaveBeenCalled();
        },
      );

      it('returns not found if the image object is absent from storage', async () => {
        send.mockRejectedValueOnce(
          Object.assign(new Error('Missing object'), { name: 'NoSuchKey' }),
        );
        const response = await read().expect(404);
        expect(response.body).toMatchObject({
          code: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
        });
        expect(readStorage).toHaveBeenCalledTimes(1);
        expect(readStorage).toHaveBeenCalledWith(image.mediaUrl);
      });

      it.each(['estate', 'media'])(
        'rejects an invalid %s UUID before object storage',
        async (parameter) => {
          await read(
            parameter === 'estate' ? 'invalid' : estate.id,
            parameter === 'media' ? 'invalid' : image.id,
          ).expect(400);
          expect(readStorage).not.toHaveBeenCalled();
          expect(send).not.toHaveBeenCalled();
        },
      );
    });

    it.each([false, true])(
      'lists DRAFT images with read permission and explicit header %s',
      async (explicit) => {
        expect(estate.status).toBe('DRAFT');
        const image = await saveImage();
        const response = await list(
          estate.id,
          explicit ? provider.id : undefined,
        ).expect(200);
        const body = response.body as SuccessResponse<MediaResponse[]>;
        expect(typeof body.timestamp).toBe('string');
        expect(body).toEqual({
          status: true,
          path: `/estates/${estate.id}/media/mine`,
          timestamp: body.timestamp,
          data: [
            {
              id: image.id,
              estateId: estate.id,
              mediaUrl: image.mediaUrl,
              type: 'image',
              sortOrder: 0,
            },
          ],
        });
        expect(send).not.toHaveBeenCalled();
      },
    );

    it('returns an empty list when no media exists', async () => {
      const response = await list().expect(200);
      expect(response.body).toMatchObject({ status: true, data: [] });
    });

    it('excludes deleted images and videos and preserves sortOrder/createdAt ordering', async () => {
      const later = await saveImage(2, new Date('2026-01-02'));
      const earlier = await saveImage(2, new Date('2026-01-01'));
      const first = await saveImage(1, new Date('2026-01-03'));
      const deleted = await saveImage(0);
      await dataSource.getRepository(Media).softDelete(deleted.id);
      await dataSource.getRepository(Media).save({
        estateId: estate.id,
        mediaUrl: 'video.mp4',
        type: MediaType.VIDEO,
        sortOrder: 0,
      });
      const response = await list().expect(200);
      const body = response.body as { data: { id: string }[] };
      expect(body.data.map((item) => item.id)).toEqual([
        first.id,
        earlier.id,
        later.id,
      ]);
    });

    it('rejects unauthenticated access', async () => {
      await list(estate.id, undefined, false).expect(401);
    });

    it('rejects another provider estate even with the same legacy customer and a forged header', async () => {
      const otherCustomer = await dataSource
        .getRepository(CustomerAccount)
        .save({ email: 'mine-other@nexus.test', password: 'unused' });
      const other = await dataSource.getRepository(ProviderAccount).save({
        ownerCustomerId: otherCustomer.id,
        displayName: 'Other',
        type: ProviderType.INDIVIDUAL,
        status: ProviderStatus.ACTIVE,
        verificationStatus: ProviderVerificationStatus.VERIFIED,
      });
      await dataSource
        .getRepository(Estate)
        .update(estate.id, { providerId: other.id });
      await saveImage();
      await list(estate.id, provider.id).expect(403);
      await list(estate.id, other.id).expect(403);
    });

    it('applies read permission revocation on the next request', async () => {
      await list().expect(200);
      await dataSource.getRepository(ProviderRolePermission).clear();
      await list().expect(403);
    });

    it('validates the estate UUID', async () => {
      await list('invalid').expect(400);
    });

    it.each(['missing', 'deleted'])(
      'returns not found for a %s estate',
      async (state) => {
        if (state === 'deleted')
          await dataSource.getRepository(Estate).softDelete(estate.id);
        const response = await list(
          state === 'missing' ? randomUUID() : estate.id,
        ).expect(404);
        expect(response.body).toMatchObject({
          status: false,
          code: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
        });
      },
    );
  });

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
