import {
  FileTypeValidator,
  Injectable,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { MediaErrorCodes } from '../errors/media-error-codes';
import type { ValidatedImage } from '../types/validated-image';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Validate tại HTTP boundary trước khi service kiểm tra quyền hoặc upload S3. */
@Injectable()
export class ImageUploadPipe implements PipeTransform<
  Express.Multer.File | undefined,
  Promise<ValidatedImage>
> {
  /** Chỉ nhận JPEG/PNG có nội dung khớp MIME khai báo, tối đa 5 MB. */
  async transform(
    file: Express.Multer.File | undefined,
  ): Promise<ValidatedImage> {
    if (!file) {
      throw new BusinessException(MediaErrorCodes.MEDIA_IMAGE_REQUIRED);
    }

    await new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({
          // Validator dùng '<'; cộng 1 để chấp nhận đúng 5 MB.
          maxSize: MAX_IMAGE_BYTES + 1,
          message: MediaErrorCodes.MEDIA_IMAGE_TOO_LARGE.code,
        }),
        new FileTypeValidator({
          fileType: /^image\/(jpeg|png)$/,
          skipMagicNumbersValidation: true,
          errorMessage: MediaErrorCodes.MEDIA_INVALID_IMAGE_UPLOAD.code,
        }),
      ],
      exceptionFactory: (error) =>
        new BusinessException(
          error === MediaErrorCodes.MEDIA_IMAGE_TOO_LARGE.code
            ? MediaErrorCodes.MEDIA_IMAGE_TOO_LARGE
            : MediaErrorCodes.MEDIA_INVALID_IMAGE_UPLOAD,
        ),
    }).transform(file);

    const detectedMime = this.detectImageMime(file.buffer);
    if (!detectedMime || detectedMime !== file.mimetype) {
      throw new BusinessException(MediaErrorCodes.MEDIA_INVALID_IMAGE_UPLOAD);
    }

    return {
      buffer: file.buffer,
      mimetype: detectedMime,
    };
  }

  private detectImageMime(
    buffer: Buffer | undefined,
  ): ValidatedImage['mimetype'] | undefined {
    if (!buffer?.length) return undefined;

    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    if (buffer.subarray(0, pngSignature.length).equals(pngSignature)) {
      return 'image/png';
    }

    const jpegSignature = Buffer.from([0xff, 0xd8, 0xff]);
    if (buffer.subarray(0, jpegSignature.length).equals(jpegSignature)) {
      return 'image/jpeg';
    }

    return undefined;
  }
}
