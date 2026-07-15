import { Injectable, Logger } from '@nestjs/common';
import { DataPool } from '../entities/data-pool.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class DataPoolService {
  private readonly logger = new Logger(DataPoolService.name);

  private readonly FULL_NAME_KEY = 'full_name';

  constructor(
    @InjectRepository(DataPool)
    private readonly dataPoolRepository: Repository<DataPool>,
  ) {}

  async getFullName(userId: string): Promise<string | null> {
    const pool = await this.dataPoolRepository.findOne({
      where: { userId, key: this.FULL_NAME_KEY },
    });
    if (!pool) return null;
    if (typeof pool.value === 'string') return pool.value;
    if (pool.value && typeof pool.value === 'object' && 'value' in pool.value) {
      return (pool.value as { value: string }).value;
    }
    return null;
  }

  async setFullName(userId: string, fullName: string): Promise<void> {
    const existing = await this.dataPoolRepository.findOne({
      where: { userId, key: this.FULL_NAME_KEY },
    });

    if (existing) {
      existing.value = { value: fullName };
      await this.dataPoolRepository.save(existing);
    } else {
      const pool = this.dataPoolRepository.create({
        userId,
        key: this.FULL_NAME_KEY,
        value: { value: fullName },
        createdBy: userId,
      });
      await this.dataPoolRepository.save(pool);
    }

    this.logger.log(`Full name updated for user ${userId}`);
  }

  async upsertValue(
    userId: string,
    key: string,
    value: Record<string, unknown>,
  ): Promise<void> {
    const existing = await this.dataPoolRepository.findOne({
      where: { userId, key },
    });

    if (existing) {
      existing.value = value;
      await this.dataPoolRepository.save(existing);
    } else {
      const pool = this.dataPoolRepository.create({
        userId,
        key,
        value,
        createdBy: userId,
      });
      await this.dataPoolRepository.save(pool);
    }

    this.logger.log(`Data pool ${key} updated for user ${userId}`);
  }
}
