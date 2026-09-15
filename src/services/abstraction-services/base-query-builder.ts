import { SelectQueryBuilder, EntityManager, ObjectLiteral } from 'typeorm';
import { PaginationOptions } from './interfaces/pagination.interface';

export class BaseQueryBuilder<T extends ObjectLiteral> {
  constructor(
    protected readonly qb: SelectQueryBuilder<T>,
    protected readonly entityManager: EntityManager,
  ) {}

  get query(): SelectQueryBuilder<T> {
    return this.qb;
  }

  /** Adds an AND predicate while preserving the fluent query-builder contract. */
  andWhere(condition: string, parameters?: Record<string, unknown>): this {
    this.qb.andWhere(condition, parameters);
    return this;
  }

  /** Adds an OR predicate while preserving the fluent query-builder contract. */
  orWhere(condition: string, parameters?: Record<string, unknown>): this {
    this.qb.orWhere(condition, parameters);
    return this;
  }

  /** Adds an inner join for a caller-owned relation and alias. */
  innerJoin(relation: string, alias: string, condition?: string): this {
    this.qb.innerJoin(relation, alias, condition);
    return this;
  }

  /** Adds a left join without changing the builder's selected root entity. */
  leftJoin(relation: string, alias: string, condition?: string): this {
    this.qb.leftJoin(relation, alias, condition);
    return this;
  }

  /** Applies the primary sort requested by a validated caller. */
  orderBy(sort: string, order?: 'ASC' | 'DESC'): this {
    this.qb.orderBy(sort, order || 'ASC');
    return this;
  }

  /** Appends a deterministic secondary sort to the query. */
  addOrderBy(sort: string, order?: 'ASC' | 'DESC'): this {
    this.qb.addOrderBy(sort, order || 'ASC');
    return this;
  }

  /** Replaces the selected fields for projection-oriented queries. */
  select(fields: string[]): this {
    this.qb.select(fields);
    return this;
  }

  /** Adds fields to the existing projection. */
  addSelect(fields: string[]): this {
    fields.forEach((f) => this.qb.addSelect(f));
    return this;
  }

  /** Applies bounded offset pagination to the current query. */
  paginate(pagination?: PaginationOptions): this {
    const page = Math.max(1, pagination?.page ?? 1);
    const limit = Math.min(100, Math.max(1, pagination?.limit ?? 10));
    this.qb.skip((page - 1) * limit).take(limit);
    return this;
  }

  /** Applies a transaction lock when a mutation needs a consistent read. */
  useLock(
    mode: 'pessimistic_write' | 'pessimistic_read' = 'pessimistic_write',
  ): this {
    this.qb.setLock(mode);
    return this;
  }

  /** Executes the builder and returns all matching entities. */
  async getMany(): Promise<T[]> {
    return this.qb.getMany();
  }

  /** Executes the builder and returns the first matching entity, if any. */
  async getOne(): Promise<T | null> {
    return this.qb.getOne();
  }

  /** Executes the builder and returns raw projected rows. */
  async getRawMany(): Promise<Record<string, unknown>[]> {
    return this.qb.getRawMany();
  }

  /** Executes a count query for the current predicates. */
  async getCount(): Promise<number> {
    return this.qb.getCount();
  }
}
