import type { EntityManager } from 'typeorm';
import type { EventEnvelope } from '../../../../common/events/contracts/event-envelope.contract';
import { OutboxEventRepo } from '../../../eventing/outbox/repositories/outbox-event.repo';
import { ListingProjectionRevisionRepo } from '../repositories/listing-projection-revision.repo';
import { MarketplaceListingOutboxService } from './marketplace-listing-outbox.service';
import {
  MARKETPLACE_LISTING_AGGREGATE_TYPE,
  MARKETPLACE_LISTING_PUBLISHED_EVENT,
  MARKETPLACE_LISTING_SEARCH_PROJECTION_CHANGED_EVENT,
} from './marketplace-listing-event.constants';
import {
  type MarketplaceListingProjectionEventPayloadV1,
  type MarketplaceListingSourceRow,
} from './marketplace-listing-event.payload';

describe('MarketplaceListingOutboxService', () => {
  const listingId = '10000000-0000-4000-8000-000000000001';
  const estateId = '20000000-0000-4000-8000-000000000001';
  const manager = {} as EntityManager;
  const source: MarketplaceListingSourceRow = {
    listingId,
    listingStatus: 'PUBLISHED',
    listingIsLive: true,
    propertyId: estateId,
    estateStatus: 'ACTIVE',
    estateIsLive: true,
    title: 'Updated after mutation',
    description: null,
    type: 'APARTMENT',
    purpose: 'SALE',
    price: '9007199254740993',
    area: '90.25',
    provinceId: '30000000-0000-4000-8000-000000000001',
    provinceName: 'Province',
    wardId: '40000000-0000-4000-8000-000000000001',
    wardName: 'Ward',
    address: '1 Main Street',
    latitude: null,
    longitude: null,
    publishedAt: '2026-10-03T08:20:31.245Z',
    updatedAt: '2026-10-03T08:20:31.245Z',
  };
  const createOutboxInsertMock = () =>
    jest.fn(
      (
        envelope: EventEnvelope<MarketplaceListingProjectionEventPayloadV1>,
        usedManager: EntityManager,
      ) => {
        void envelope;
        void usedManager;
        return Promise.resolve(undefined);
      },
    );

  it('uses the returned revision and same manager to record a listing event', async () => {
    const revisionRepositoryMock = {
      incrementProjectionRevision: jest.fn().mockResolvedValue('7'),
      incrementProjectionRevisionByEstateId: jest.fn(),
    };
    const snapshotRepositoryMock = {
      loadSource: jest.fn().mockResolvedValue(source),
      loadImages: jest.fn().mockResolvedValue([]),
    };
    const outboxRepositoryMock = {
      insert: createOutboxInsertMock(),
    };
    const service = new MarketplaceListingOutboxService(
      revisionRepositoryMock as unknown as ListingProjectionRevisionRepo,
      snapshotRepositoryMock,
      outboxRepositoryMock as unknown as OutboxEventRepo,
    );

    await expect(
      service.bumpAndRecordListing(
        listingId,
        MARKETPLACE_LISTING_PUBLISHED_EVENT,
        manager,
      ),
    ).resolves.toBe('7');

    expect(snapshotRepositoryMock.loadSource).toHaveBeenCalledWith(
      listingId,
      manager,
    );
    const [envelope, usedManager] = outboxRepositoryMock.insert.mock.calls[0];
    expect(envelope).toMatchObject({
      eventType: MARKETPLACE_LISTING_PUBLISHED_EVENT,
      aggregateType: MARKETPLACE_LISTING_AGGREGATE_TYPE,
      aggregateId: listingId,
      revision: '7',
      traceId: null,
      payload: {
        deleted: false,
        document: {
          title: 'Updated after mutation',
          price: '9007199254740993',
        },
      },
    });
    expect(usedManager).toBe(manager);
  });

  it('records the initial revision without incrementing it', async () => {
    const revisionRepositoryMock = {
      incrementProjectionRevision: jest.fn(),
      incrementProjectionRevisionByEstateId: jest.fn(),
    };
    const snapshotRepositoryMock = {
      loadSource: jest.fn().mockResolvedValue({
        ...source,
        listingStatus: 'DRAFT',
      }),
      loadImages: jest.fn(),
    };
    const outboxRepositoryMock = {
      insert: createOutboxInsertMock(),
    };
    const service = new MarketplaceListingOutboxService(
      revisionRepositoryMock as unknown as ListingProjectionRevisionRepo,
      snapshotRepositoryMock,
      outboxRepositoryMock as unknown as OutboxEventRepo,
    );

    await service.recordInitialListing(listingId, '1', manager);

    expect(
      revisionRepositoryMock.incrementProjectionRevision,
    ).not.toHaveBeenCalled();
    const [envelope, usedManager] = outboxRepositoryMock.insert.mock.calls[0];
    expect(envelope).toMatchObject({
      eventType: MARKETPLACE_LISTING_SEARCH_PROJECTION_CHANGED_EVENT,
      revision: '1',
      payload: { deleted: true, document: null },
    });
    expect(usedManager).toBe(manager);
  });

  it('does not write an event when an estate has no listing', async () => {
    const revisionRepositoryMock = {
      incrementProjectionRevision: jest.fn(),
      incrementProjectionRevisionByEstateId: jest.fn().mockResolvedValue(null),
    };
    const snapshotRepositoryMock = {
      loadSource: jest.fn(),
      loadImages: jest.fn(),
    };
    const outboxRepositoryMock = {
      insert: createOutboxInsertMock(),
    };
    const service = new MarketplaceListingOutboxService(
      revisionRepositoryMock as unknown as ListingProjectionRevisionRepo,
      snapshotRepositoryMock,
      outboxRepositoryMock as unknown as OutboxEventRepo,
    );

    await expect(
      service.bumpAndRecordByEstateId(
        estateId,
        MARKETPLACE_LISTING_SEARCH_PROJECTION_CHANGED_EVENT,
        manager,
      ),
    ).resolves.toBeNull();
    expect(outboxRepositoryMock.insert).not.toHaveBeenCalled();
  });
});
