import { EstateRepo } from './estate.repo';
import { EstateStatus } from '../types/estate.type';

describe('EstateRepo public inventory', () => {
  it('returns only active, non-deleted estates with locations', async () => {
    const rows = [{ id: 'estate-id' }];
    const query = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    const repository = { createQueryBuilder: jest.fn().mockReturnValue(query) };
    const dataSource = {
      createEntityManager: jest.fn(),
      getRepository: jest.fn().mockReturnValue(repository),
    };
    const repo = new EstateRepo(dataSource as never);

    await expect(repo.findPublicActive()).resolves.toBe(rows);
    expect(query.innerJoinAndSelect).toHaveBeenCalledWith(
      'estate.province',
      'province',
    );
    expect(query.innerJoinAndSelect).toHaveBeenCalledWith(
      'estate.ward',
      'ward',
    );
    expect(query.where).toHaveBeenCalledWith('estate.status = :status', {
      status: EstateStatus.ACTIVE,
    });
    expect(query.andWhere).toHaveBeenCalledWith('estate.deletedAt IS NULL');
    expect(query.orderBy).toHaveBeenCalledWith('estate.createdAt', 'DESC');
  });
});
