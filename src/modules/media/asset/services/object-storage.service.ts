import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { S3_CLIENT } from '../providers/s3-client.provider';
import type { ValidatedImage } from '../types/validated-image';

// Extension luôn theo MIME đã validate, không lấy từ tên file của client.
const IMAGE_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
} as const;

/** Chỉ lưu và xóa object qua S3 API; caller chịu trách nhiệm validate và quyền. */
@Injectable()
export class ObjectStorageService {
  private readonly bucket: string;

  constructor(
    @Inject(S3_CLIENT)
    private readonly s3Client: S3Client,
    configService: ConfigService,
  ) {
    // Đọc bucket một lần khi Nest tạo service; thiếu cấu hình thì fail ngay.
    this.bucket = configService.getOrThrow<string>('S3_BUCKET');
  }

  /** Upload ảnh đã validate và trả object key sau khi S3 chấp nhận dữ liệu. */
  async uploadEstateImage(
    estateId: string,
    file: ValidatedImage,
  ): Promise<string> {
    const objectKey = `estates/${estateId}/${randomUUID()}${IMAGE_EXTENSIONS[file.mimetype]}`;
    const putCommand = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    });
    await this.s3Client.send(putCommand);
    return objectKey;
  }

  /** Read stored bytes through the configured S3 endpoint, keeping the bucket private. */
  async readEstateImage(objectKey: string) {
    try {
      const object = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      if (
        !object.Body ||
        !['image/jpeg', 'image/png'].includes(object.ContentType ?? '')
      ) {
        throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND);
      }
      return {
        body: Buffer.from(await object.Body.transformToByteArray()),
        contentType: object.ContentType!,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND);
      }
      throw error;
    }
  }

  /** Xóa đúng object key; lỗi SDK được trả nguyên cho caller xử lý. */
  async deleteObject(objectKey: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
  }
}
