import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Estate } from './property/entities';
import { EstateController } from './property/controllers/estate.controller';
import { EstateRepo } from './property/repositories/estate.repo';
import { EstateService } from './property/services/estate.service';
import { ProviderModule } from '../provider/provider.module';
import { LocationModule } from '../location/location.module';
import { ListingModule } from '../listing/listing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Estate]),
    ProviderModule,
    LocationModule,
    ListingModule,
  ],
  controllers: [EstateController],
  providers: [EstateRepo, EstateService],
})
export class EstateModule {}
