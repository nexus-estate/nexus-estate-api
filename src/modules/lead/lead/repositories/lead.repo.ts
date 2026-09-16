import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Lead } from '../entities';

@Injectable()
export class LeadRepo {
  private readonly repository: Repository<Lead>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(Lead);
  }

  create(data: Partial<Lead>): Lead {
    return this.repository.create(data);
  }

  save(lead: Lead): Promise<Lead> {
    return this.repository.save(lead);
  }
}
