import { Injectable, Logger } from '@nestjs/common';
import { MediaRepository } from '../repositories/media.repository';
import { MediaType, type Media } from '../entities';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { EstateService } from '../../../estate/property/services/estate.service';
import { ObjectStorageService } from './object-storage.service';
import type { ValidatedImage } from '../types/validated-image';

/** Điều phối quyền, thứ tự hiển thị, upload và lưu Media; không validate multipart. */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly estateService: EstateService,
    private readonly objectStorageService: ObjectStorageService,
  ) {}

  /** Public estate policy also enforces provider availability and soft deletion. */
  async listPublic(estateId: string): Promise<Media[]> {
    await this.estateService.findPublicById(estateId);
    return (await this.mediaRepository.findByEstateId(estateId)).filter(
      (media) => media.type === MediaType.IMAGE,
    );
  }

  async readPublicImage(estateId: string, mediaId: string) {
    await this.estateService.findPublicById(estateId);
    const media = await this.mediaRepository.findByIdAndEstateId(
      mediaId,
      estateId,
    );
    if (!media || media.type !== MediaType.IMAGE) {
      throw new BusinessException(CommonErrorCodes.RESOURCE_NOT_FOUND, mediaId);
    }
    return this.objectStorageService.readEstateImage(media.mediaUrl);
  }

  /**
   * EstateService kiểm tra Provider ACTIVE/VERIFIED, membership và property:update.
   * Transaction giữ thứ tự ảnh nhất quán; nếu insert/commit fail thì xóa object.
   * Cleanup fail được log riêng và không thay thế lỗi DB gốc.
   */
  async createMedia(
    customerId: string,
    estateId: string,
    file: ValidatedImage,
    providerId?: string,
  ): Promise<Media> {
    let objectKey: string | undefined;
    try {
      return await this.mediaRepository.withEstateLock(
        estateId,
        async (manager) => {
          // Chỉ EstateService resolve Provider và quyết định quyền/ownership.
          const estate = await this.estateService.findOwnedByIdForUpdate(
            customerId,
            estateId,
            providerId,
          );
          const sortOrder = await this.mediaRepository.getNextSortOrder(
            estate.id,
            manager,
          );
          objectKey = await this.objectStorageService.uploadEstateImage(
            estate.id,
            file,
          );
          return this.mediaRepository.createEstateImage(
            estate.id,
            objectKey,
            customerId,
            sortOrder,
            manager,
          );
        },
      );
    } catch (persistenceError) {
      // Chỉ cleanup khi S3 đã upload thành công; catch cũng bao phủ commit fail.
      if (objectKey) {
        try {
          await this.objectStorageService.deleteObject(objectKey);
        } catch (cleanupError) {
          this.logger.error(
            `Không thể cleanup object ${objectKey} sau lỗi lưu Media`,
            cleanupError instanceof Error ? cleanupError.stack : cleanupError,
          );
        }
      }
      throw persistenceError;
    }
  }
}
