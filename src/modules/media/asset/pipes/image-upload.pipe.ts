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

    // MIME đã qua allowlist trước khi dùng làm pattern kiểm tra magic bytes.
    const contentValidator = new FileTypeValidator({
      fileType: new RegExp(`^${file.mimetype}$`),
    });
    if (!(await contentValidator.isValid(file))) {
      throw new BusinessException(MediaErrorCodes.MEDIA_INVALID_IMAGE_UPLOAD);
    }

    return {
      buffer: file.buffer,
      // Chỉ thu hẹp type sau khi các validator đã thành công.
      mimetype: file.mimetype as ValidatedImage['mimetype'],
    };
  }
}
