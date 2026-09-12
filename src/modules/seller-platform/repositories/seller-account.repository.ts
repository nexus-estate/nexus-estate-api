import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial, Repository } from 'typeorm';

import { SellerAccount } from '../models/seller-account.entity';

@Injectable()
export class SellerAccountRepository {
  constructor(
    @InjectRepository(SellerAccount)
    private readonly repository: Repository<SellerAccount>,
  ) {}

  findById(id: string): Promise<SellerAccount | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByOwnerUserId(ownerUserId: string): Promise<SellerAccount | null> {
    return this.repository.findOne({ where: { ownerUserId } });
  }

  async existsByOwnerUserId(ownerUserId: string): Promise<boolean> {
    return this.repository.exists({ where: { ownerUserId } });
  }

  save(data: DeepPartial<SellerAccount>): Promise<SellerAccount> {
    return this.repository.save(this.repository.create(data));
  }
}
