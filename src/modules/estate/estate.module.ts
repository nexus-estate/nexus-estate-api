import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Estate } from './property/entities';
import {
  Province,
  Ward,
} from '../location/administrative-division/entities/location.entity';
import { EstateController } from './property/controllers/estate.controller';
import { EstateRepo } from './property/repositories/estate.repo';
import { ProvinceRepo } from '../../database/seed/locations/repositories/province.repo';
import { WardRepository } from '../../database/seed/locations/repositories/ward.repo';
import { EstateService } from './property/services/estate.service';
import { ProviderModule } from '../provider/provider.module';

@Module({
  imports: [TypeOrmModule.forFeature([Estate, Ward, Province]), ProviderModule],
  controllers: [EstateController],
  providers: [EstateRepo, ProvinceRepo, WardRepository, EstateService],
})
export class EstateModule {}
