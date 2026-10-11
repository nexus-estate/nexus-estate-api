import { Logger } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { ValidatedImage } from '../types/validated-image';
import { MediaService } from './media.service';
import type { MediaRepository } from '../repositories/media.repository';
import type { ObjectStorageService } from './object-storage.service';
import type { EstateService } from '../../../estate/property/services/estate.service';
import type { Estate } from '../../../estate/property/entities';
import { Media, MediaType } from '../entities';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';

describe('MediaService', () => {
  const customerId = '10000000-0000-4000-8000-000000000001';
  const estateId = '20000000-0000-4000-8000-000000000001';
  const providerId = '30000000-0000-4000-8000-000000000001';
  const estate = { id: estateId, providerId } as Estate;
  const file = {
    buffer: Buffer.from('image bytes'),
    mimetype: 'image/png',
  } satisfies ValidatedImage;
  const manager = {} as EntityManager;
  const objectKey = `estates/${estateId}/image.png`;
  const saved = Object.assign(new Media(), {
    id: '40000000-0000-4000-8000-000000000001',
    estateId,
    mediaUrl: objectKey,
    type: MediaType.IMAGE,
    sortOrder: 0,
  });
  let estateService: jest.Mocked<Pick<EstateService, 'findOwnedByIdForUpdate'>>;
  let repository: jest.Mocked<
    Pick<
      MediaRepository,
      'withEstateLock' | 'getNextSortOrder' | 'createEstateImage'
    >
  >;
  let storage: jest.Mocked<
    Pick<ObjectStorageService, 'uploadEstateImage' | 'deleteObject'>
  >;
  let service: MediaService;

  beforeEach(() => {
    estateService = {
      findOwnedByIdForUpdate: jest.fn().mockResolvedValue(estate),
    };
    repository = {
      withEstateLock: jest
        .fn()
        .mockImplementation(
          async (_id, operation: (manager: EntityManager) => Promise<Media>) =>
            operation(manager),
        ),
      getNextSortOrder: jest.fn().mockResolvedValue(0),
      createEstateImage: jest.fn().mockResolvedValue(saved),
    };
    storage = {
      uploadEstateImage: jest.fn().mockResolvedValue(objectKey),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    service = new MediaService(
      repository as unknown as MediaRepository,
      estateService as unknown as EstateService,
      storage as unknown as ObjectStorageService,
    );
  });

  it('authorizes, uploads, persists, and returns the saved media', async () => {
    await expect(
      service.createMedia(customerId, estateId, file, providerId),
    ).resolves.toBe(saved);
    expect(estateService.findOwnedByIdForUpdate).toHaveBeenCalledWith(
      customerId,
      estateId,
      providerId,
    );
    expect(repository.getNextSortOrder).toHaveBeenCalledWith(estateId, manager);
    expect(
      repository.getNextSortOrder.mock.invocationCallOrder[0],
    ).toBeLessThan(storage.uploadEstateImage.mock.invocationCallOrder[0]);
    expect(storage.uploadEstateImage).toHaveBeenCalledWith(estateId, file);
    expect(repository.createEstateImage).toHaveBeenCalledWith(
      estateId,
      objectKey,
      customerId,
      0,
      manager,
    );
    expect(
      estateService.findOwnedByIdForUpdate.mock.invocationCallOrder[0],
    ).toBeLessThan(storage.uploadEstateImage.mock.invocationCallOrder[0]);
    expect(storage.uploadEstateImage.mock.invocationCallOrder[0]).toBeLessThan(
      repository.createEstateImage.mock.invocationCallOrder[0],
    );
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('delegates default Provider context selection to EstateService', async () => {
    await service.createMedia(customerId, estateId, file);
    expect(estateService.findOwnedByIdForUpdate).toHaveBeenCalledWith(
      customerId,
      estateId,
      undefined,
    );
  });

  it.each([
    CommonErrorCodes.AUTHENTICATION_REQUIRED,
    CommonErrorCodes.FORBIDDEN,
    CommonErrorCodes.RESOURCE_NOT_FOUND,
  ])('avoids all upload side effects after $code', async (code) => {
    const error = new BusinessException(code);
    estateService.findOwnedByIdForUpdate.mockRejectedValueOnce(error);
    await expect(
      service.createMedia(customerId, estateId, file, providerId),
    ).rejects.toBe(error);
    expect(storage.uploadEstateImage).not.toHaveBeenCalled();
    expect(repository.createEstateImage).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('does not create media or attempt deletion when upload fails', async () => {
    const error = new Error('Upload failed');
    storage.uploadEstateImage.mockRejectedValueOnce(error);
    await expect(service.createMedia(customerId, estateId, file)).rejects.toBe(
      error,
    );
    expect(repository.createEstateImage).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('removes the uploaded object and preserves a persistence failure', async () => {
    const error = new Error('Database write failed');
    repository.createEstateImage.mockRejectedValueOnce(error);
    await expect(service.createMedia(customerId, estateId, file)).rejects.toBe(
      error,
    );
    expect(storage.deleteObject).toHaveBeenCalledWith(objectKey);
  });

  it('logs cleanup failure and rethrows the original database error', async () => {
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const persistenceError = new Error('Database write failed');
    const cleanupError = new Error('Delete failed');
    repository.createEstateImage.mockRejectedValueOnce(persistenceError);
    storage.deleteObject.mockRejectedValueOnce(cleanupError);
    await expect(service.createMedia(customerId, estateId, file)).rejects.toBe(
      persistenceError,
    );
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining(objectKey),
      cleanupError.stack,
    );
    logError.mockRestore();
  });
  it('does not upload if sort order lookup fails', async () => {
    const error = new Error('Order query failed');
    repository.getNextSortOrder.mockRejectedValueOnce(error);
    await expect(service.createMedia(customerId, estateId, file)).rejects.toBe(
      error,
    );
    expect(storage.uploadEstateImage).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('cleans up when transaction commit fails after inserting media', async () => {
    const error = new Error('Commit failed');
    repository.withEstateLock.mockImplementationOnce(async (_id, operation) => {
      await operation(manager);
      throw error;
    });
    await expect(service.createMedia(customerId, estateId, file)).rejects.toBe(
      error,
    );
    expect(repository.createEstateImage).toHaveBeenCalledTimes(1);
    expect(storage.deleteObject).toHaveBeenCalledWith(objectKey);
  });
});
