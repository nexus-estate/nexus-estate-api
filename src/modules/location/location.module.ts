import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Province,
  Ward,
} from './administrative-division/entities/location.entity';
import { ProvinceRepo } from './administrative-division/repositories/province.repo';
import { WardRepository } from './administrative-division/repositories/ward.repo';
import { LocationService } from './administrative-division/services/location.service';
import { LocationController } from './administrative-division/controllers/location.controller';

/** Owns administrative-division reference data and its read endpoints. */
@Module({
  imports: [TypeOrmModule.forFeature([Province, Ward])],
  controllers: [LocationController],
  providers: [ProvinceRepo, WardRepository, LocationService],
  exports: [ProvinceRepo, WardRepository, LocationService],
})
export class LocationModule {}
