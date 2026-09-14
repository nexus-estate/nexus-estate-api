import {
  Repository,
  FindOptionsWhere,
  FindManyOptions,
  DeepPartial,
  EntityManager,
  DataSource,
  EntityTarget,
} from 'typeorm';
import { Logger } from '@nestjs/common';
import { BaseEntity } from './base.entity';
import { IBaseRepository } from './interfaces/repository.interface';
import {
  PaginationOptions,
  PaginatedResult,
} from './interfaces/pagination.interface';
import { BaseQueryBuilder } from './base-query-builder';

export abstract class BaseRepository<
  T extends BaseEntity,
> implements IBaseRepository<T> {
  protected readonly repository: Repository<T>;
  protected readonly manager: EntityManager;
  protected readonly logger: Logger;

  constructor(
    protected readonly dataSource: DataSource,
    entity: EntityTarget<T>,
    protected readonly contextName: string,
  ) {
    this.manager = dataSource.createEntityManager();
    this.repository = dataSource.getRepository(entity);
    this.logger = new Logger(`${contextName}Repository`);
  }

  /** Creates the repository's fluent query builder for a validated root alias. */
  createQueryBuilder(alias: string): BaseQueryBuilder<T> {
    const qb = this.repository.createQueryBuilder(alias);
    return new BaseQueryBuilder<T>(qb, this.manager);
  }

  async transaction<R>(
    operation: (manager: EntityManager) => Promise<R>,
  ): Promise<R> {
    return this.dataSource.transaction(operation);
  }

  /** Persists a new entity and returns the managed entity instance. */
  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  /** Finds one non-deleted entity by exact primary-key identifier. */
  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<T> });
  }

  /** Finds one non-deleted entity matching the supplied repository predicate. */
  async findOne(where: FindOptionsWhere<T>): Promise<T | null> {
    return this.repository.findOne({ where });
  }

  /** Lists non-deleted entities with the caller's bounded repository options. */
  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  /** Lists non-deleted entities with normalized offset pagination metadata. */
  async findAllPaginated(
    options?: FindManyOptions<T>,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<T>> {
    const { pagination: p, skip, take } = this.resolvePagination(pagination);
    const [items, total] = await this.repository.findAndCount({
      ...options,
      skip,
      take,
    });
    return {
      items,
      meta: {
        total,
        page: p.page,
        limit: p.limit,
        totalPages: Math.ceil(total / p.limit),
        hasNextPage: p.page < Math.ceil(total / p.limit),
        hasPreviousPage: p.page > 1,
      },
    };
  }

  /** Updates one exact entity and returns the refreshed persisted record. */
  async update(id: string, data: DeepPartial<T>): Promise<T> {
    await this.repository.update(id, data as never);
    const updated = await this.findById(id);
    if (!updated)
      throw new Error(
        `Entity ${this.contextName} with id ${id} not found after update`,
      );
    return updated;
  }

  /** Marks one exact entity deleted while retaining its audit history. */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /** Permanently removes one exact entity for explicitly approved cleanup flows. */
  async hardDelete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /** Counts non-deleted entities matching an optional repository predicate. */
  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repository.count({ where });
  }

  /** Normalizes page input to safe skip/take values used by list queries. */
  resolvePagination(pagination?: PaginationOptions): {
    pagination: Required<PaginationOptions>;
    skip: number;
    take: number;
  } {
    const page = Math.max(1, pagination?.page ?? 1);
    const limit = Math.min(100, Math.max(1, pagination?.limit ?? 10));
    return {
      pagination: { page, limit },
      skip: (page - 1) * limit,
      take: limit,
    };
  }
}
