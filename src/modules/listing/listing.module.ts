import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Estate } from '../estate/property/entities';
import { EstateRepo } from '../estate/property/repositories/estate.repo';
import { ProviderModule } from '../provider/provider.module';
import { Listing } from './listing/entities';
import { ListingController } from './listing/controllers/listing.controller';
import { ListingRepo } from './listing/repositories/listing.repo';
import { ListingProjectionRevisionRepo } from './listing/repositories/listing-projection-revision.repo';
import { ListingService } from './listing/services/listing.service';
import { EventingModule } from '../eventing/eventing.module';
import { MarketplaceListingOutboxService } from './listing/events/marketplace-listing-outbox.service';
import { MarketplaceListingSnapshotRepo } from './listing/events/marketplace-listing-snapshot.repo';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, Estate]),
    ProviderModule,
    EventingModule,
  ],
  controllers: [ListingController],
  providers: [
    ListingRepo,
    ListingProjectionRevisionRepo,
    MarketplaceListingSnapshotRepo,
    MarketplaceListingOutboxService,
    EstateRepo,
    ListingService,
  ],
  exports: [ListingRepo, MarketplaceListingOutboxService],
})
export class ListingModule {}
