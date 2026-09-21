import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../listing/listing/entities';
import { Lead } from './lead/entities';
import { LeadController } from './lead/controllers/lead.controller';
import { LeadRepo } from './lead/repositories/lead.repo';
import { LeadService } from './lead/services/lead.service';

@Module({
  imports: [TypeOrmModule.forFeature([Lead, Listing])],
  controllers: [LeadController],
  providers: [LeadRepo, LeadService],
})
export class LeadModule {}
