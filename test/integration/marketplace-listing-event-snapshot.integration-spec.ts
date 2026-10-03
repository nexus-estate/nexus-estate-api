import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { typeOrmConfig } from '../../src/database/type.config';
import { buildMarketplaceListingProjectionPayload } from '../../src/modules/listing/listing/events/marketplace-listing-event.payload';
import { MarketplaceListingSnapshotRepo } from '../../src/modules/listing/listing/events/marketplace-listing-snapshot.repo';

jest.setTimeout(120_000);

describe('Marketplace Listing snapshot (PostgreSQL integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const snapshots = new MarketplaceListingSnapshotRepo();
  const listingId = '10000000-0000-4000-8000-000000000001';
  const estateId = '20000000-0000-4000-8000-000000000001';
  const provinceId = '30000000-0000-4000-8000-000000000001';
  const wardId = '40000000-0000-4000-8000-000000000001';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_marketplace_snapshot_test')
      .withUsername('test')
      .withPassword('test')
      .start();
    dataSource = new DataSource({
      ...(typeOrmConfig as PostgresConnectionOptions),
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [],
      migrations: [],
    });
    await dataSource.initialize();
    await dataSource.query(`
      CREATE TABLE tbl_province (id uuid PRIMARY KEY, name varchar(100) NOT NULL);
      CREATE TABLE tbl_ward (id uuid PRIMARY KEY, name varchar(100) NOT NULL);
      CREATE TABLE tbl_estate (
        id uuid PRIMARY KEY,
        status varchar(20) NOT NULL,
        deleted_at timestamptz NULL,
        title varchar(500) NOT NULL,
        description text NULL,
        type varchar(40) NOT NULL,
        purpose varchar(40) NOT NULL,
        price bigint NOT NULL,
        area numeric(10, 2) NULL,
        fk_province_id uuid NOT NULL,
        fk_ward_id uuid NOT NULL,
        address_line varchar(500) NOT NULL,
        latitude numeric(10, 7) NULL,
        longitude numeric(10, 7) NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE tbl_listing (
        id uuid PRIMARY KEY,
        fk_estate_id uuid NOT NULL,
        status varchar(20) NOT NULL,
        deleted_at timestamptz NULL,
        published_at timestamptz NULL
      );
      CREATE TABLE tbl_media (
        id uuid PRIMARY KEY,
        fk_estate_id uuid NOT NULL,
        media_url varchar(1000) NOT NULL,
        type varchar(20) NOT NULL,
        sort_order int NOT NULL,
        deleted_at timestamptz NULL
      );
    `);
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE tbl_media, tbl_listing, tbl_estate, tbl_ward, tbl_province',
    );
    await dataSource.query(
      `INSERT INTO tbl_province (id, name) VALUES ($1, 'Province')`,
      [provinceId],
    );
    await dataSource.query(
      `INSERT INTO tbl_ward (id, name) VALUES ($1, 'Ward')`,
      [wardId],
    );
    await dataSource.query(
      `INSERT INTO tbl_estate
        (id, status, title, description, type, purpose, price, area,
         fk_province_id, fk_ward_id, address_line, latitude, longitude, updated_at)
       VALUES ($1, 'ACTIVE', 'Original title', NULL, 'APARTMENT', 'SALE',
         '9007199254740993', '82.50', $2, $3, '1 Main Street', '10.1234567',
         '106.1234567', '2026-10-03T08:20:31.245Z')`,
      [estateId, provinceId, wardId],
    );
    await dataSource.query(
      `INSERT INTO tbl_listing (id, fk_estate_id, status, published_at)
       VALUES ($1, $2, 'PUBLISHED', '2026-10-03T08:19:00.000Z')`,
      [listingId, estateId],
    );
  });

  it('loads a live searchable snapshot with lossless numeric source text', async () => {
    const source = await snapshots.loadSource(listingId, dataSource.manager);

    expect(source).toMatchObject({
      listingId,
      listingStatus: 'PUBLISHED',
      listingIsLive: true,
      propertyId: estateId,
      estateStatus: 'ACTIVE',
      estateIsLive: true,
      price: '9007199254740993',
      area: '82.50',
      latitude: '10.1234567',
      longitude: '106.1234567',
      provinceName: 'Province',
      wardName: 'Ward',
    });
    expect(buildMarketplaceListingProjectionPayload(source!, [])).toMatchObject(
      {
        deleted: false,
        document: {
          price: '9007199254740993',
          area: '82.50',
          location: { lat: '10.1234567', lon: '106.1234567' },
          media: { images: [] },
        },
      },
    );
  });

  it('orders live images by sort_order then ID and caps at twenty', async () => {
    const images = Array.from({ length: 25 }, (_, index) => ({
      id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      url: `image-${index + 1}`,
      sortOrder: index < 4 ? 1 : index,
    }));
    await dataSource.query(
      `INSERT INTO tbl_media (id, fk_estate_id, media_url, type, sort_order)
       VALUES ${images.map((_, index) => `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5})`).join(', ')}`,
      images.flatMap((image) => [
        image.id,
        estateId,
        image.url,
        'image',
        image.sortOrder,
      ]),
    );
    await dataSource.query(
      `INSERT INTO tbl_media (id, fk_estate_id, media_url, type, sort_order, deleted_at)
       VALUES ('60000000-0000-4000-8000-000000000001', $1, 'deleted-image', 'image', 0, NOW()),
              ('60000000-0000-4000-8000-000000000002', $1, 'video', 'video', 0, NULL)`,
      [estateId],
    );

    const urls = await snapshots.loadImages(estateId, dataSource.manager);
    const expected = [...images]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      .slice(0, 20)
      .map(({ url }) => url);
    expect(urls).toEqual(expected);
    expect(urls).toHaveLength(20);
  });

  it('retains the relationship row and produces tombstone source after soft delete', async () => {
    await dataSource.query(
      'UPDATE tbl_estate SET deleted_at = NOW() WHERE id = $1',
      [estateId],
    );
    const source = await snapshots.loadSource(listingId, dataSource.manager);

    expect(source?.propertyId).toBe(estateId);
    expect(source?.estateIsLive).toBe(false);
    expect(buildMarketplaceListingProjectionPayload(source!, [])).toEqual({
      deleted: true,
      document: null,
    });
  });

  it('reads an uncommitted Estate update through the caller transaction manager', async () => {
    await dataSource
      .transaction(async (manager) => {
        await manager.query('UPDATE tbl_estate SET title = $1 WHERE id = $2', [
          'Uncommitted title',
          estateId,
        ]);
        const source = await snapshots.loadSource(listingId, manager);
        expect(source?.title).toBe('Uncommitted title');
        throw new Error('force rollback');
      })
      .catch((error: unknown) => {
        expect(error).toMatchObject({ message: 'force rollback' });
      });

    await expect(
      dataSource.query('SELECT title FROM tbl_estate WHERE id = $1', [
        estateId,
      ]),
    ).resolves.toEqual([{ title: 'Original title' }]);
  });
});
