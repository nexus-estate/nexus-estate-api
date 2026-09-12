import { PaginationHelper } from './pagination.helper';

describe('PaginationHelper', () => {
  describe('normalize', () => {
    it('should return defaults when no pagination provided', () => {
      const result = PaginationHelper.normalize();
      expect(result).toEqual({ page: 1, limit: 10 });
    });

    it('should cap limit at 100', () => {
      const result = PaginationHelper.normalize({ page: 1, limit: 200 });
      expect(result.limit).toBe(100);
    });

    it('should ensure page >= 1', () => {
      const result = PaginationHelper.normalize({ page: 0, limit: 10 });
      expect(result.page).toBe(1);
    });

    it('should ensure limit >= 1', () => {
      const result = PaginationHelper.normalize({ page: 1, limit: 0 });
      expect(result.limit).toBe(1);
    });
  });

  describe('buildMeta', () => {
    it('should build pagination meta correctly', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const result = PaginationHelper.buildMeta(items, 20, {
        page: 1,
        limit: 2,
      });
      expect(result.items).toHaveLength(2);
      expect(result.meta.total).toBe(20);
      expect(result.meta.totalPages).toBe(10);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(false);
    });
  });
});
