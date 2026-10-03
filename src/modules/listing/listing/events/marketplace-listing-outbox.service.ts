import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { CommonErrorCodes } from '../../../../common/errors/common-error-codes';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import type { EventEnvelope } from '../../../../common/events/contracts/event-envelope.contract';
import { OutboxEventRepo } from '../../../eventing/outbox/repositories/outbox-event.repo';
import {
  MARKETPLACE_LISTING_AGGREGATE_TYPE,
  MARKETPLACE_LISTING_SEARCH_PROJECTION_CHANGED_EVENT,
  type MarketplaceListingEventType,
} from './marketplace-listing-event.constants';
import {
  buildMarketplaceListingProjectionPayload,
  isSearchableMarketplaceListing,
  type MarketplaceListingProjectionEventPayloadV1,
} from './marketplace-listing-event.payload';
import { MarketplaceListingSnapshotRepo } from './marketplace-listing-snapshot.repo';
import { ListingProjectionRevisionRepo } from '../repositories/listing-projection-revision.repo';

/** Coordinates one Listing revision, its transaction-local snapshot, and durable envelope. */
@Injectable()
export class MarketplaceListingOutboxService {
  constructor(
    private readonly revisionRepository: ListingProjectionRevisionRepo,
    private readonly snapshotRepository: MarketplaceListingSnapshotRepo,
    private readonly outboxEventRepository: OutboxEventRepo,
  ) {}

  /** Records the initial revision-1 DRAFT tombstone in Listing creation's transaction. */
  async recordInitialListing(
    listingId: string,
    revision: string,
    manager: EntityManager,
  ): Promise<void> {
    await this.record(
      listingId,
      revision,
      MARKETPLACE_LISTING_SEARCH_PROJECTION_CHANGED_EVENT,
      manager,
    );
  }

  /** Bumps one Listing and records its post-mutation state in the same transaction. */
  async bumpAndRecordListing(
    listingId: string,
    eventType: MarketplaceListingEventType,
    manager: EntityManager,
  ): Promise<string> {
    const revision = await this.revisionRepository.incrementProjectionRevision(
      listingId,
      manager,
    );
    if (revision === null) {
      throw new BusinessException(CommonErrorCodes.DATABASE_ERROR);
    }
    await this.record(listingId, revision, eventType, manager);
    return revision;
  }

  /** Bumps and records a live Listing for an Estate command; no Listing means no event. */
  async bumpAndRecordByEstateId(
    estateId: string,
    eventType: MarketplaceListingEventType,
    manager: EntityManager,
  ): Promise<{ listingId: string; revision: string } | null> {
    const result =
      await this.revisionRepository.incrementProjectionRevisionByEstateId(
        estateId,
        manager,
      );
    if (result === null) return null;
    await this.record(result.listingId, result.revision, eventType, manager);
    return result;
  }

  private async record(
    listingId: string,
    revision: string,
    eventType: MarketplaceListingEventType,
    manager: EntityManager,
  ): Promise<void> {
    const source = await this.snapshotRepository.loadSource(listingId, manager);
    if (source === null) {
      throw new BusinessException(CommonErrorCodes.DATABASE_ERROR);
    }
    const imageUrls =
      isSearchableMarketplaceListing(source) && source.propertyId !== null
        ? await this.snapshotRepository.loadImages(source.propertyId, manager)
        : [];
    const payload: MarketplaceListingProjectionEventPayloadV1 =
      buildMarketplaceListingProjectionPayload(source, imageUrls);
    const envelope: EventEnvelope<MarketplaceListingProjectionEventPayloadV1> =
      {
        eventId: randomUUID(),
        eventType,
        aggregateType: MARKETPLACE_LISTING_AGGREGATE_TYPE,
        aggregateId: listingId,
        revision,
        occurredAt: new Date().toISOString(),
        traceId: null,
        payload,
      };
    await this.outboxEventRepository.insert(envelope, manager);
  }
}
