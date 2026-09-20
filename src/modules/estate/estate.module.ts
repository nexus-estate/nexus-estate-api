import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Estate } from './property/entities';
import {
  Province,
  Ward,
} from '../location/administrative-division/entities/location.entity';
import { EstateController } from './property/controllers/estate.controller';
import { EstateRepo } from './property/repositories/estate.repo';
import { EstateService } from './property/services/estate.service';
import { ProviderModule } from '../provider/provider.module';
import { LocationModule } from '../location/location.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Estate, Ward, Province]),
    ProviderModule,
    LocationModule,
  ],
  controllers: [EstateController],
  providers: [EstateRepo, EstateService],
})
export class EstateModule {}
