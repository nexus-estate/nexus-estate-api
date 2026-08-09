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

  andWhere(condition: string, parameters?: Record<string, unknown>): this {
    this.qb.andWhere(condition, parameters);
    return this;
  }

  orWhere(condition: string, parameters?: Record<string, unknown>): this {
    this.qb.orWhere(condition, parameters);
    return this;
  }

  innerJoin(relation: string, alias: string, condition?: string): this {
    this.qb.innerJoin(relation, alias, condition);
    return this;
  }

  leftJoin(relation: string, alias: string, condition?: string): this {
    this.qb.leftJoin(relation, alias, condition);
    return this;
  }

  orderBy(sort: string, order?: 'ASC' | 'DESC'): this {
    this.qb.orderBy(sort, order || 'ASC');
    return this;
  }

  addOrderBy(sort: string, order?: 'ASC' | 'DESC'): this {
    this.qb.addOrderBy(sort, order || 'ASC');
    return this;
  }

  select(fields: string[]): this {
    this.qb.select(fields);
    return this;
  }

  addSelect(fields: string[]): this {
    fields.forEach((f) => this.qb.addSelect(f));
    return this;
  }

  paginate(pagination?: PaginationOptions): this {
    const page = Math.max(1, pagination?.page ?? 1);
    const limit = Math.min(100, Math.max(1, pagination?.limit ?? 10));
    this.qb.skip((page - 1) * limit).take(limit);
    return this;
  }

  useLock(
    mode: 'pessimistic_write' | 'pessimistic_read' = 'pessimistic_write',
  ): this {
    this.qb.setLock(mode);
    return this;
  }

  async getMany(): Promise<T[]> {
    return this.qb.getMany();
  }

  async getOne(): Promise<T | null> {
    return this.qb.getOne();
  }

  async getRawMany(): Promise<Record<string, unknown>[]> {
    return this.qb.getRawMany();
  }

  async getCount(): Promise<number> {
    return this.qb.getCount();
  }
}
