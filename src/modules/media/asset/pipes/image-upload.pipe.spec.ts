import { Readable } from 'node:stream';
import { ImageUploadPipe, MAX_IMAGE_BYTES } from './image-upload.pipe';
import { MediaErrorCodes } from '../errors/media-error-codes';

describe('ImageUploadPipe', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP2sAAAAASUVORK5CYII=',
    'base64',
  );
  const pipe = new ImageUploadPipe();
  const file = (
    changes: Partial<Express.Multer.File> = {},
  ): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'untrusted.txt',
    encoding: '7bit',
    mimetype: 'image/png',
    size: png.length,
    buffer: png,
    destination: '',
    filename: '',
    path: '',
    stream: Readable.from(png),
    ...changes,
  });

  it('returns only validated content and MIME, independently of the filename', async () => {
    await expect(pipe.transform(file())).resolves.toEqual({
      buffer: png,
      mimetype: 'image/png',
    });
  });

  it('requires a file', async () => {
    await expect(pipe.transform(undefined)).rejects.toMatchObject({
      errorCode: MediaErrorCodes.MEDIA_IMAGE_REQUIRED.code,
    });
  });

  it.each(['image/webp', 'image/png'])(
    'rejects WebP content even when declared as %s',
    async (mimetype) => {
      const buffer = Buffer.from(
        'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
        'base64',
      );
      await expect(
        pipe.transform(file({ buffer, size: buffer.length, mimetype })),
      ).rejects.toMatchObject({
        errorCode: MediaErrorCodes.MEDIA_INVALID_IMAGE_UPLOAD.code,
      });
    },
  );

  it.each([
    { buffer: Buffer.alloc(0), size: 0 },
    { buffer: undefined },
    { mimetype: 'image/jpeg' },
    { mimetype: 'image/[' },
    { mimetype: 'image/png; charset=utf-8' },
  ])('rejects invalid content or MIME: %s', async (changes) => {
    await expect(pipe.transform(file(changes))).rejects.toMatchObject({
      errorCode: MediaErrorCodes.MEDIA_INVALID_IMAGE_UPLOAD.code,
    });
  });

  it('accepts the inclusive 5 MB boundary', async () => {
    const buffer = Buffer.alloc(MAX_IMAGE_BYTES);
    png.copy(buffer);
    await expect(
      pipe.transform(file({ buffer, size: buffer.length })),
    ).resolves.toMatchObject({ mimetype: 'image/png' });
  });

  it('returns the localized business error for an oversize file before content validation', async () => {
    await expect(
      pipe.transform(file({ size: MAX_IMAGE_BYTES + 1 })),
    ).rejects.toMatchObject({
      errorCode: MediaErrorCodes.MEDIA_IMAGE_TOO_LARGE.code,
    });
  });
});
