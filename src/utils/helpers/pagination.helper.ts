import type {
  PaginatedResult,
  PaginationOptions,
} from '../../services/abstraction-services/interfaces/pagination.interface';

export class PaginationHelper {
  static buildMeta<T>(
    items: T[],
    total: number,
    pagination: PaginationOptions,
  ): PaginatedResult<T> {
    const { page = 1, limit = 10 } = pagination;
    const totalPages = Math.ceil(total / limit);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  static normalize(
    pagination?: PaginationOptions,
  ): Required<PaginationOptions> {
    return {
      page: Math.max(1, pagination?.page ?? 1),
      limit: Math.min(100, Math.max(1, pagination?.limit ?? 10)),
    };
  }
}
