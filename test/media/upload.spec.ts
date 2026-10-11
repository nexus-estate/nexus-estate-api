import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { BusinessExceptionFilter } from '../../src/common/filters/business-exception.filter';
import { CustomerJwtAuthGuard } from '../../src/modules/customer/authentication/guards/customer-jwt-auth.guard';
import { MediaController } from '../../src/modules/media/asset/controllers/media.controller';
import { MediaErrorCodes } from '../../src/modules/media/asset/errors/media-error-codes';
import { Media, MediaType } from '../../src/modules/media/asset/entities';
import { MediaService } from '../../src/modules/media/asset/services/media.service';

describe('MediaController image upload (HTTP)', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP2sAAAAASUVORK5CYII=',
    'base64',
  );
  const jpeg = Buffer.from(
    'ffd8ffe000104a46494600010100000100010000ffd9',
    'hex',
  );
  const webp = Buffer.from(
    'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
    'base64',
  );
  const estateId = '20000000-0000-4000-8000-000000000001';
  const customerId = '10000000-0000-4000-8000-000000000001';
  const providerId = '30000000-0000-4000-8000-000000000001';
  const url = `/estates/${estateId}/media`;
  const maximumSize = 5 * 1024 * 1024;
  const createMedia = jest
    .fn<
      ReturnType<MediaService['createMedia']>,
      Parameters<MediaService['createMedia']>
    >()
    .mockResolvedValue(
      Object.assign(new Media(), {
        id: 'saved-media-id',
        estateId,
        mediaUrl: 'estates/estate-id/image.png',
        type: MediaType.IMAGE,
        sortOrder: 0,
      }),
    );
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: { createMedia } }],
    })
      .overrideGuard(CustomerJwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context
            .switchToHttp()
            .getRequest<{ user: { id: string; realm: string } }>();
          req.user = { id: customerId, realm: 'customer' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    app.useGlobalFilters(new BusinessExceptionFilter());
    await app.init();
  });

  beforeEach(() => {
    createMedia.mockClear();
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each([
    ['front.png', 'image/png', png],
    ['front.jpg', 'image/jpeg', jpeg],
    ['front.jpeg', 'image/jpeg', jpeg],
    ['front.PNG', 'image/png', png],
    ['front.JPG', 'image/jpeg', jpeg],
    ['renamed.txt', 'image/png', png],
    ['no-extension', 'image/jpeg', jpeg],
    ['front.jpg', 'image/png', png],
    ['front.exe', 'image/png', png],
  ])(
    'passes %s to MediaService as an in-memory file',
    async (filename, mime, image) => {
      await request(app.getHttpServer())
        .post(url)
        .attach('file', image, { filename, contentType: mime })
        .expect(201)
        .expect({
          id: 'saved-media-id',
          estateId,
          mediaUrl: 'estates/estate-id/image.png',
          type: 'image',
          sortOrder: 0,
        });
      expect(createMedia).toHaveBeenCalledTimes(1);
      const file = createMedia.mock.calls[0][2];
      expect(file).toBeDefined();
      expect(file?.buffer).toEqual(image);
      expect(file?.mimetype).toBe(mime);
      expect(file).not.toHaveProperty('originalname');
      expect(file).not.toHaveProperty('path');
    },
  );

  it.each([
    ['front.gif', 'image/gif', Buffer.from('GIF89a')],
    ['front.webp', 'image/webp', Buffer.from('RIFF WEBP')],
    ['front.webp', 'image/webp', webp],
    ['renamed.png', 'image/png', webp],
    ['document.pdf', 'application/pdf', Buffer.from('%PDF')],
    ['front.png', 'application/octet-stream', png],
    ['front.png', 'image/png', jpeg],
    ['front.jpg', 'image/jpeg', png],
    ['front.png', 'image/png', Buffer.from('not an image')],
    ['front.jpg', 'image/jpeg', Buffer.from('<svg></svg>')],
    ['front.png', 'image/png', Buffer.alloc(0)],
  ])(
    'rejects unsupported or mislabeled files: %s / %s',
    async (filename, mime, image) => {
      const response = await request(app.getHttpServer())
        .post(url)
        .attach('file', image, { filename, contentType: mime })
        .expect(400);
      expect(response.body).toMatchObject({
        status: false,
        code: MediaErrorCodes.MEDIA_INVALID_IMAGE_UPLOAD.code,
      });
      expect(createMedia).not.toHaveBeenCalled();
    },
  );

  it('accepts an image of exactly 5 MB', async () => {
    const image = Buffer.alloc(maximumSize);
    png.copy(image);
    await request(app.getHttpServer())
      .post(url)
      .attach('file', image, {
        filename: 'large.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(createMedia.mock.calls[0][2]?.buffer.length).toBe(maximumSize);
  });

  it.each([maximumSize + 1, maximumSize + 1024])(
    'rejects an image of %s bytes with a Multer 413 before the service',
    async (size) => {
      const image = Buffer.alloc(size);
      png.copy(image);
      const response = await request(app.getHttpServer())
        .post(url)
        .attach('file', image, {
          filename: 'large.png',
          contentType: 'image/png',
        })
        .expect(413);
      expect(response.body).toMatchObject({ statusCode: 413 });
      expect(createMedia).not.toHaveBeenCalled();
    },
  );

  it('rejects a request without a file', async () => {
    const response = await request(app.getHttpServer())
      .post(url)
      .send({})
      .expect(400);
    expect(response.body).toMatchObject({
      code: MediaErrorCodes.MEDIA_IMAGE_REQUIRED.code,
    });
    expect(createMedia).not.toHaveBeenCalled();
  });

  it('rejects a different multipart field', async () => {
    await request(app.getHttpServer())
      .post(url)
      .attach('avatar', png, {
        filename: 'front.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect(createMedia).not.toHaveBeenCalled();
  });

  it('rejects multiple files', async () => {
    await request(app.getHttpServer())
      .post(url)
      .attach('file', png, { filename: 'front.png', contentType: 'image/png' })
      .attach('file', png, { filename: 'back.png', contentType: 'image/png' })
      .expect(400);
    expect(createMedia).not.toHaveBeenCalled();
  });

  it('returns the upload validation message in Vietnamese', async () => {
    const response = await request(app.getHttpServer())
      .post(url)
      .set('x-lang', 'vi')
      .attach('file', Buffer.from('GIF89a'), {
        filename: 'front.gif',
        contentType: 'image/gif',
      })
      .expect(400);
    expect(response.body).toMatchObject({
      code: MediaErrorCodes.MEDIA_INVALID_IMAGE_UPLOAD.code,
      message: MediaErrorCodes.MEDIA_INVALID_IMAGE_UPLOAD.messages.vi,
    });
    expect(response.headers['content-language']).toBe('vi');
    expect(createMedia).not.toHaveBeenCalled();
  });

  it('passes authenticated customer and selected Provider context to the service', async () => {
    await request(app.getHttpServer())
      .post(url)
      .set('X-Provider-Id', providerId)
      .attach('file', png, { filename: 'front.png', contentType: 'image/png' })
      .expect(201);
    expect(createMedia).toHaveBeenCalledWith(
      customerId,
      estateId,
      { buffer: png, mimetype: 'image/png' },
      providerId,
    );
  });

  it('rejects an invalid estate UUID before calling the service', async () => {
    await request(app.getHttpServer())
      .post('/estates/invalid/media')
      .attach('file', png, { filename: 'front.png', contentType: 'image/png' })
      .expect(400);
    expect(createMedia).not.toHaveBeenCalled();
  });
});
