import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { CommonErrorCodes } from '../../src/common/errors/common-error-codes';
import { BusinessException } from '../../src/common/exceptions/business.exception';
import { BusinessExceptionFilter } from '../../src/common/filters/business-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { CustomerAccountService } from '../../src/modules/customer/account/services/customer-account.service';
import { CustomerJwtStrategy } from '../../src/modules/customer/authentication/strategies/customer-jwt.strategy';
import { EstateService } from '../../src/modules/estate/property/services/estate.service';
import { MediaController } from '../../src/modules/media/asset/controllers/media.controller';
import { Media, MediaType } from '../../src/modules/media/asset/entities';
import { MediaRepository } from '../../src/modules/media/asset/repositories/media.repository';
import { MediaService } from '../../src/modules/media/asset/services/media.service';
import { ObjectStorageService } from '../../src/modules/media/asset/services/object-storage.service';
import type { ValidatedImage } from '../../src/modules/media/asset/types/validated-image';

// Real JWT guard, controller and MediaService; DB authorization is covered in asset.spec.ts.
describe('Owned estate image content (HTTP)', () => {
  const customerId = '10000000-0000-4000-8000-000000000001';
  const estateId = '20000000-0000-4000-8000-000000000001';
  const providerId = '30000000-0000-4000-8000-000000000001';
  const mediaId = '40000000-0000-4000-8000-000000000001';
  const url = `/estates/${estateId}/media/${mediaId}/content/mine`;
  const secret = 'nexus-owned-media-test-secret';
  const signToken = (realm = 'customer') =>
    new JwtService().sign(
      { sub: customerId, realm, tokenType: 'access', sessionId: 'media-test' },
      { secret },
    );
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP2sAAAAASUVORK5CYII=',
    'base64',
  );
  const jpeg = Buffer.from(
    'ffd8ffe000104a46494600010100000100010000ffd9',
    'hex',
  );
  const media = Object.assign(new Media(), {
    id: mediaId,
    estateId,
    type: MediaType.IMAGE,
    mediaUrl: `estates/${estateId}/image.png`,
  });
  const estate: jest.Mocked<Pick<EstateService, 'findOwnedById'>> = {
    findOwnedById: jest.fn(),
  };
  const repository: jest.Mocked<Pick<MediaRepository, 'findByIdAndEstateId'>> =
    {
      findByIdAndEstateId: jest.fn(),
    };
  const storage: jest.Mocked<Pick<ObjectStorageService, 'readEstateImage'>> = {
    readEstateImage: jest.fn(),
  };
  const account = { findById: jest.fn() };
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        MediaService,
        CustomerJwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({ CUSTOMER_JWT_ACCESS_SECRET: secret }),
        },
        {
          provide: CustomerAccountService,
          useValue: account,
        },
        { provide: EstateService, useValue: estate },
        { provide: MediaRepository, useValue: repository },
        { provide: ObjectStorageService, useValue: storage },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    app.useGlobalFilters(new BusinessExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    account.findById.mockResolvedValue({
      id: customerId,
      email: 'owned-media@nexus.test',
    });
    estate.findOwnedById.mockResolvedValue({
      id: estateId,
      status: 'DRAFT',
    } as Awaited<ReturnType<EstateService['findOwnedById']>>);
    repository.findByIdAndEstateId.mockResolvedValue(media);
    storage.readEstateImage.mockResolvedValue({
      buffer: png,
      mimetype: 'image/png',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const read = (path = url) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${signToken()}`);

  it.each([
    ['image/png', png],
    ['image/jpeg', jpeg],
  ] satisfies [ValidatedImage['mimetype'], Buffer][])(
    'returns exact %s bytes without a JSON envelope',
    async (mimetype, buffer) => {
      storage.readEstateImage.mockResolvedValue({ buffer, mimetype });
      const response = await read()
        .set('X-Provider-Id', providerId)
        .expect(200);
      expect(response.headers['content-type']).toBe(mimetype);
      expect(response.body).toEqual(buffer);
      expect(estate.findOwnedById).toHaveBeenCalledWith(
        customerId,
        estateId,
        providerId,
      );
      expect(repository.findByIdAndEstateId).toHaveBeenCalledWith(
        mediaId,
        estateId,
      );
      expect(storage.readEstateImage).toHaveBeenCalledTimes(1);
      expect(storage.readEstateImage).toHaveBeenCalledWith(media.mediaUrl);
    },
  );

  it('delegates default Provider context selection to EstateService', async () => {
    await read().expect(200);
    expect(estate.findOwnedById).toHaveBeenCalledWith(
      customerId,
      estateId,
      undefined,
    );
  });

  it.each([
    ['X-Content-Type-Options', 'nosniff'],
    ['Cache-Control', 'no-store'],
  ])('sets %s: %s on private image responses', async (header, value) => {
    await read().expect(200).expect(header, value);
  });

  it('rejects unauthenticated access before authorization or storage', async () => {
    await request(app.getHttpServer()).get(url).expect(401);
    expect(estate.findOwnedById).not.toHaveBeenCalled();
    expect(repository.findByIdAndEstateId).not.toHaveBeenCalled();
    expect(storage.readEstateImage).not.toHaveBeenCalled();
  });

  it('rejects an Administration token before authorization or storage', async () => {
    await request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${signToken('administration')}`)
      .expect(401);
    expect(estate.findOwnedById).not.toHaveBeenCalled();
    expect(storage.readEstateImage).not.toHaveBeenCalled();
  });

  it.each([CommonErrorCodes.FORBIDDEN, CommonErrorCodes.RESOURCE_NOT_FOUND])(
    'preserves $code from Estate authorization without reading media or storage',
    async (code) => {
      estate.findOwnedById.mockRejectedValueOnce(new BusinessException(code));
      const response = await read().expect(code.httpStatus);
      expect(response.body).toMatchObject({ status: false, code: code.code });
      expect(repository.findByIdAndEstateId).not.toHaveBeenCalled();
      expect(storage.readEstateImage).not.toHaveBeenCalled();
    },
  );

  it('returns not found when no image matches both URL identifiers', async () => {
    repository.findByIdAndEstateId.mockResolvedValueOnce(null);
    const response = await read().expect(404);
    expect(response.body).toMatchObject({
      code: CommonErrorCodes.RESOURCE_NOT_FOUND.code,
    });
    expect(repository.findByIdAndEstateId).toHaveBeenCalledWith(
      mediaId,
      estateId,
    );
    expect(storage.readEstateImage).not.toHaveBeenCalled();
  });

  it.each([
    `/estates/invalid/media/${mediaId}/content/mine`,
    `/estates/${estateId}/media/invalid/content/mine`,
  ])('rejects invalid UUIDs at %s before service access', async (path) => {
    await read(path).expect(400);
    expect(estate.findOwnedById).not.toHaveBeenCalled();
    expect(repository.findByIdAndEstateId).not.toHaveBeenCalled();
    expect(storage.readEstateImage).not.toHaveBeenCalled();
  });
});
