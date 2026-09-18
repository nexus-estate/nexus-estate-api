import { MODULE_METADATA } from '@nestjs/common/constants';
import { ListingController } from './listing/controllers/listing.controller';
import { ListingModule } from './listing.module';
import { ListingService } from './listing/services/listing.service';

describe('listing module', () => {
  it('wires the listing HTTP adapter and service from the feature boundary', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ListingModule),
    ).toContain(ListingController);
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ListingModule),
    ).toContain(ListingService);
  });
});
