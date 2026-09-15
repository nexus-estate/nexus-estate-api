import { Logger, NotFoundException } from '@nestjs/common';
import { DeepPartial, FindManyOptions, FindOptionsWhere } from 'typeorm';
import { BaseEntity } from './base.entity';
import { BaseRepository } from './base.repository';
import {
  PaginatedResult,
  PaginationOptions,
} from './interfaces/pagination.interface';

export abstract class BaseService<
  T extends BaseEntity,
  C extends DeepPartial<T> = DeepPartial<T>,
  U extends DeepPartial<T> = DeepPartial<T>,
> {
  protected readonly logger: Logger;

  constructor(
    protected readonly repository: BaseRepository<T>,
    contextName: string,
  ) {
    this.logger = new Logger(`${contextName}Service`);
  }

  /** Creates an entity through the repository abstraction owned by the feature. */
  async create(data: C): Promise<T> {
    try {
      const entity = await this.repository.create(data);
      this.logger.log(`Created ${this.getEntityName()}: ${entity.id}`);
      return entity;
    } catch (error) {
      this.logger.error(
        `Failed to create ${this.getEntityName()}: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /** Loads one exact entity or raises the service's stable not-found error. */
  async findOne(id: string): Promise<T> {
    const entity = await this.repository.findById(id);
    if (!entity)
      throw new NotFoundException(
        `${this.getEntityName()} with id ${id} not found`,
      );
    return entity;
  }

  /** Lists entities through the repository without exposing persistence details. */
  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.findAll(options);
  }

  /** Returns a normalized paginated entity result for management/list screens. */
  async findAllPaginated(
    pagination?: PaginationOptions,
    options?: FindManyOptions<T>,
  ): Promise<PaginatedResult<T>> {
    return this.repository.findAllPaginated(options, pagination);
  }

  /** Updates one exact entity after loading it through the repository boundary. */
  async update(id: string, data: U): Promise<T> {
    try {
      await this.findOne(id);
      const updated = await this.repository.update(id, data);
      this.logger.log(`Updated ${this.getEntityName()}: ${id}`);
      return updated;
    } catch (error) {
      this.logger.error(
        `Failed to update ${this.getEntityName()} ${id}: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /** Soft-removes one exact entity and returns the standard success message. */
  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id);
    await this.repository.softDelete(id); //Shared contract for soft delete
    this.logger.log(`Deleted ${this.getEntityName()}: ${id}`);
    return { message: `${this.getEntityName()} deleted successfully` };
  }

  /** Counts entities using the feature repository's non-deleted semantics. */
  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repository.count(where);
  }

  protected getEntityName(): string {
    return this.constructor.name.replace('Service', '');
  }

  protected getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
