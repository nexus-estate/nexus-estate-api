import { DeepPartial, FindManyOptions, FindOptionsWhere } from 'typeorm';

export interface IBaseRepository<T> {
  create(data: DeepPartial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findOne(where: FindOptionsWhere<T>): Promise<T | null>;
  findAll(options?: FindManyOptions<T>): Promise<T[]>;
  update(id: string, data: DeepPartial<T>): Promise<T>;
  softDelete(id: string): Promise<void>;
  hardDelete(id: string): Promise<void>;
  count(where?: FindOptionsWhere<T>): Promise<number>;
}
