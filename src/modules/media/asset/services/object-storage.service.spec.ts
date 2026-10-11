import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { ObjectStorageService } from './object-storage.service';
import type { ValidatedImage } from '../types/validated-image';

describe('ObjectStorageService', () => {
  const estateId = '20000000-0000-4000-8000-000000000001';
  const file = {
    mimetype: 'image/png',
    buffer: Buffer.from('image bytes'),
  } satisfies ValidatedImage;
  let service: ObjectStorageService;
  let send: jest.Mock<
    Promise<unknown>,
    [PutObjectCommand | DeleteObjectCommand]
  >;

  beforeEach(() => {
    send = jest
      .fn<Promise<unknown>, [PutObjectCommand | DeleteObjectCommand]>()
      .mockResolvedValue({});
    service = new ObjectStorageService(
      { send } as unknown as S3Client,
      new ConfigService({ S3_BUCKET: 'estate-images' }),
    );
  });

  it('uploads the buffer and MIME type with a unique estate-scoped key', async () => {
    const key = await service.uploadEstateImage(estateId, file);
    expect(key).toMatch(
      new RegExp(`^estates/${estateId}/[0-9a-f-]{36}\\.png$`),
    );
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'estate-images',
      Key: key,
      Body: file.buffer,
      ContentType: 'image/png',
    });
    await expect(service.uploadEstateImage(estateId, file)).resolves.not.toBe(
      key,
    );
  });

  it.each([
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
  ] as const)(
    'uses %s to generate extension %s',
    async (mimetype, extension) => {
      const key = await service.uploadEstateImage(estateId, {
        ...file,
        mimetype,
      });
      expect(key.endsWith(extension)).toBe(true);
      expect(send.mock.calls[0][0].input).toMatchObject({
        ContentType: mimetype,
      });
    },
  );

  it('reads the bucket once when constructing the service', async () => {
    const configService = new ConfigService({ S3_BUCKET: 'estate-images' });
    const getOrThrow = jest.spyOn(configService, 'getOrThrow');
    service = new ObjectStorageService(
      { send } as unknown as S3Client,
      configService,
    );
    await service.uploadEstateImage(estateId, file);
    await service.deleteObject('image.png');
    expect(getOrThrow).toHaveBeenCalledTimes(1);
    expect(getOrThrow).toHaveBeenCalledWith('S3_BUCKET');
  });

  it('does not return a key when S3 rejects the upload', async () => {
    const error = new Error('S3 unavailable');
    send.mockRejectedValueOnce(error);
    await expect(service.uploadEstateImage(estateId, file)).rejects.toBe(error);
  });

  it('fails before sending if the bucket is not configured', () => {
    expect(
      () =>
        new ObjectStorageService(
          { send } as unknown as S3Client,
          new ConfigService(),
        ),
    ).toThrow('S3_BUCKET');
    expect(send).not.toHaveBeenCalled();
  });

  it('deletes only the specified object in the configured bucket', async () => {
    const key = `estates/${estateId}/failed-upload.png`;
    await service.deleteObject(key);
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: 'estate-images', Key: key });
  });

  it('propagates S3 cleanup failures', async () => {
    const error = new Error('S3 delete unavailable');
    send.mockRejectedValueOnce(error);
    await expect(service.deleteObject('failed-upload.png')).rejects.toBe(error);
  });
});
