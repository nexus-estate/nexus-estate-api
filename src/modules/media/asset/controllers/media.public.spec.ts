import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { MediaController } from './media.controller';
import { MediaService } from '../services/media.service';
import { MediaRepository } from '../repositories/media.repository';
import { ObjectStorageService } from '../services/object-storage.service';
import { EstateService } from '../../../estate/property/services/estate.service';
import { CustomerJwtAuthGuard } from '../../../customer/authentication/guards/customer-jwt-auth.guard';
import { TransformInterceptor } from '../../../../common/interceptors/transform.interceptor';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';

describe('Public estate media HTTP', () => {
  const estateId = '20000000-0000-4000-8000-000000000001';
  const mediaId = '40000000-0000-4000-8000-000000000001';
  const image = {
    id: mediaId,
    estateId,
    type: 'image',
    sortOrder: 0,
    mediaUrl: 'estates/image.png',
  };
  const estate = { findPublicById: jest.fn() };
  const repository = {
    findByEstateId: jest.fn(),
    findByIdAndEstateId: jest.fn(),
  };
  const storage = { readEstateImage: jest.fn() };
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        MediaService,
        { provide: EstateService, useValue: estate },
        { provide: MediaRepository, useValue: repository },
        { provide: ObjectStorageService, useValue: storage },
      ],
    })
      .overrideGuard(CustomerJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    estate.findPublicById.mockResolvedValue({ id: estateId });
    repository.findByEstateId.mockResolvedValue([image]);
    repository.findByIdAndEstateId.mockResolvedValue(image);
    storage.readEstateImage.mockResolvedValue({
      body: Buffer.from([137, 80, 78, 71]),
      contentType: 'image/png',
    });
  });

  it('lists the estate images with an explicit response contract', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get(`/estates/${estateId}/media`)
      .expect(200);
    expect((response.body as { data: (typeof image)[] }).data).toEqual([image]);
    expect(estate.findPublicById).toHaveBeenCalledWith(estateId);
    expect(repository.findByEstateId).toHaveBeenCalledWith(estateId);
  });
  it('returns stored image bytes without a JSON envelope', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get(`/estates/${estateId}/media/${mediaId}/content`)
      .expect(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(Buffer.from([137, 80, 78, 71]));
    expect(repository.findByIdAndEstateId).toHaveBeenCalledWith(
      mediaId,
      estateId,
    );
    expect(storage.readEstateImage).toHaveBeenCalledWith(image.mediaUrl);
  });
  it('blocks both metadata and content when the estate is not public', async () => {
    estate.findPublicById.mockRejectedValue(
      new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND),
    );
    await request(app.getHttpServer() as Server)
      .get(`/estates/${estateId}/media`)
      .expect(404);
    await request(app.getHttpServer() as Server)
      .get(`/estates/${estateId}/media/${mediaId}/content`)
      .expect(404);
    expect(repository.findByEstateId).not.toHaveBeenCalled();
    expect(storage.readEstateImage).not.toHaveBeenCalled();
  });
  it('does not read an image belonging to another estate', async () => {
    repository.findByIdAndEstateId.mockResolvedValue(null);
    await request(app.getHttpServer() as Server)
      .get(`/estates/${estateId}/media/${mediaId}/content`)
      .expect(404);
    expect(storage.readEstateImage).not.toHaveBeenCalled();
  });
  it('validates identifiers before reading storage', async () => {
    await request(app.getHttpServer() as Server)
      .get(`/estates/${estateId}/media/invalid/content`)
      .expect(400);
    expect(storage.readEstateImage).not.toHaveBeenCalled();
  });
});
