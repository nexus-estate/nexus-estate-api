import { DeepPartial } from 'typeorm';
import { PaginatedResult, PaginationOptions } from './pagination.interface';

export interface IBaseService<
  T,
  C extends DeepPartial<T> = DeepPartial<T>,
  U extends DeepPartial<T> = DeepPartial<T>,
> {
  create(data: C): Promise<T>;
  findOne(id: string): Promise<T>;
  findAll(): Promise<T[]>;
  findAllPaginated(pagination?: PaginationOptions): Promise<PaginatedResult<T>>;
  update(id: string, data: U): Promise<T>;
  remove(id: string): Promise<{ message: string }>;
}
