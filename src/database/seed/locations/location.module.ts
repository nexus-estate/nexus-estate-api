import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Province,
  Ward,
} from '../../../modules/location/administrative-division/entities/location.entity';
import { ProvinceRepo } from './repositories/province.repo';
import { WardRepository } from './repositories/ward.repo';
import { locationService } from './services/location.service';
import { locationController } from './location.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Province, Ward])],
  controllers: [locationController],
  providers: [ProvinceRepo, WardRepository, locationService],
})
export class LocationModule {}
