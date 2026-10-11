import type { DataSource, EntityManager } from 'typeorm';
import { MediaRepository } from './media.repository';
import { Media, MediaType } from '../entities';
import { Estate } from '../../../estate/property/entities';

describe('MediaRepository', () => {
  const estate = { id: 'estate-id', providerId: 'provider-id' };
  const media = Object.assign(new Media(), {
    id: 'media-id',
    estateId: estate.id,
    mediaUrl: 'estates/estate-id/image.png',
    type: MediaType.IMAGE,
    sortOrder: 4,
    createdBy: 'customer-id',
  });

  const setup = () => {
    const mediaQuery = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ maxSortOrder: '3' }),
      getMany: jest.fn().mockResolvedValue([media]),
      getOne: jest.fn().mockResolvedValue(media),
    };
    const estateQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(estate),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(mediaQuery),
      create: jest.fn((data: Partial<Media>) =>
        Object.assign(new Media(), data),
      ),
      save: jest.fn().mockResolvedValue(media),
    };
    const manager = {
      getRepository: jest.fn((entity: typeof Media | typeof Estate) =>
        entity === Estate
          ? { createQueryBuilder: jest.fn().mockReturnValue(estateQuery) }
          : repository,
      ),
    };
    const dataSource = {
      createEntityManager: jest.fn().mockReturnValue(manager),
      getRepository: jest.fn().mockReturnValue({ ...repository, manager }),
      transaction: jest.fn(
        async (callback: (manager: EntityManager) => Promise<Media>) =>
          callback(manager as unknown as EntityManager),
      ),
    };
    return {
      repo: new MediaRepository(dataSource as unknown as DataSource),
      dataSource,
      mediaQuery,
      estateQuery,
      repository,
      manager: manager as unknown as EntityManager,
    };
  };

  it('scopes display queries to non-deleted media for one estate', async () => {
    const { repo, mediaQuery } = setup();
    await expect(repo.findByEstateId(estate.id)).resolves.toEqual([media]);
    expect(mediaQuery.where).toHaveBeenCalledWith(
      'media.estateId = :estateId',
      { estateId: estate.id },
    );
    expect(mediaQuery.andWhere).toHaveBeenCalledWith('media.deletedAt IS NULL');
    expect(mediaQuery.orderBy).toHaveBeenCalledWith('media.sortOrder', 'ASC');
    expect(mediaQuery.addOrderBy).toHaveBeenCalledWith(
      'media.createdAt',
      'ASC',
    );
  });

  it('requires both the media ID and estate ID for detail queries', async () => {
    const { repo, mediaQuery } = setup();
    await expect(repo.findByIdAndEstateId(media.id, estate.id)).resolves.toBe(
      media,
    );
    expect(mediaQuery.where).toHaveBeenCalledWith('media.id = :mediaId', {
      mediaId: media.id,
    });
    expect(mediaQuery.andWhere).toHaveBeenCalledWith(
      'media.estateId = :estateId',
      { estateId: estate.id },
    );
    expect(mediaQuery.andWhere).toHaveBeenCalledWith('media.deletedAt IS NULL');
  });

  it.each([
    [null, 0],
    [undefined, 0],
    ['0', 1],
    ['3', 4],
    [5, 6],
  ])('allocates order %s -> %s for live media', async (maximum, expected) => {
    const { repo, mediaQuery } = setup();
    mediaQuery.getRawOne.mockResolvedValueOnce({ maxSortOrder: maximum });
    await expect(repo.getNextSortOrder(estate.id)).resolves.toBe(expected);
    expect(mediaQuery.where).toHaveBeenCalledWith(
      'media.estateId = :estateId',
      { estateId: estate.id },
    );
    expect(mediaQuery.andWhere).toHaveBeenCalledWith('media.deletedAt IS NULL');
  });

  it('locks the estate and inserts the next image within the transaction', async () => {
    const { repo, dataSource, estateQuery, repository } = setup();
    await expect(
      repo.withEstateLock(estate.id, async (transactionManager) => {
        const sortOrder = await repo.getNextSortOrder(
          estate.id,
          transactionManager,
        );
        return repo.createEstateImage(
          estate.id,
          media.mediaUrl,
          'customer-id',
          sortOrder,
          transactionManager,
        );
      }),
    ).resolves.toBe(media);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(estateQuery.where).toHaveBeenCalledWith('estate.id = :estateId', {
      estateId: estate.id,
    });
    expect(estateQuery.andWhere).toHaveBeenCalledWith(
      'estate.deletedAt IS NULL',
    );
    expect(estateQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(repository.create).toHaveBeenCalledWith({
      estateId: estate.id,
      mediaUrl: media.mediaUrl,
      type: MediaType.IMAGE,
      sortOrder: 4,
      createdBy: 'customer-id',
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ estateId: estate.id, sortOrder: 4 }),
    );
  });

  it('waits for the estate lock before allocating an order', async () => {
    const { repo, estateQuery, mediaQuery } = setup();
    let releaseLock!: (locked: typeof estate) => void;
    const lock = new Promise<typeof estate>((resolve) => {
      releaseLock = resolve;
    });
    estateQuery.getOne.mockReturnValueOnce(lock);
    const pending = repo.withEstateLock(estate.id, async (manager) => {
      const order = await repo.getNextSortOrder(estate.id, manager);
      return repo.createEstateImage(
        estate.id,
        media.mediaUrl,
        'customer-id',
        order,
        manager,
      );
    });
    expect(mediaQuery.getRawOne).not.toHaveBeenCalled();
    releaseLock(estate);
    await expect(pending).resolves.toBe(media);
    expect(mediaQuery.getRawOne).toHaveBeenCalledTimes(1);
  });

  it('propagates insertion failure from the transaction', async () => {
    const { repo, repository, manager } = setup();
    const error = new Error('Insert failed');
    repository.save.mockRejectedValueOnce(error);
    await expect(
      repo.createEstateImage(
        estate.id,
        media.mediaUrl,
        'customer-id',
        4,
        manager,
      ),
    ).rejects.toBe(error);
  });
});
