import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Province,
  Ward,
} from '../../../modules/location/entities/location.entity';
import { ProvinceRepo } from './repositories/province.repo';
import { wardRepository } from './repositories/ward.repo';
import { locationService } from './services/location.service';
import { locationController } from './location.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Province, Ward])],
  controllers: [locationController],
  providers: [ProvinceRepo, wardRepository, locationService],
})
export class LocationModule {}
