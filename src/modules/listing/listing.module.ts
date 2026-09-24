import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Estate } from '../estate/property/entities';
import { EstateRepo } from '../estate/property/repositories/estate.repo';
import { ProviderModule } from '../provider/provider.module';
import { Listing } from './listing/entities';
import { ListingController } from './listing/controllers/listing.controller';
import { ListingRepo } from './listing/repositories/listing.repo';
import { ListingService } from './listing/services/listing.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, Estate]), ProviderModule],
  controllers: [ListingController],
  providers: [ListingRepo, EstateRepo, ListingService],
  exports: [ListingRepo],
})
export class ListingModule {}
