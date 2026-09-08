import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Estate } from './entities';
import { Province, Ward } from '../location/entities/location.entity';
import { EstateController } from './controller/estate.controller';
import { EstateRepo } from './repositories/estate.repo';
import { ProvinceRepo } from '../../database/seed/locations/repositories/province.repo';
import { WardRepository } from '../../database/seed/locations/repositories/ward.repo';
import { EstateService } from './services/estate.service';

@Module({
  imports: [TypeOrmModule.forFeature([Estate, Ward, Province])],
  controllers: [EstateController],
  providers: [EstateRepo, ProvinceRepo, WardRepository, EstateService],
})
export class EstateModule {}
