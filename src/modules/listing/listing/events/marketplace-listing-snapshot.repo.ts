import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { MarketplaceListingSourceRow } from './marketplace-listing-event.payload';

const UTC_ISO_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"';

/** Reads Marketplace source rows, including soft-deleted rows needed for tombstones. */
@Injectable()
export class MarketplaceListingSnapshotRepo {
  async loadSource(
    listingId: string,
    manager: EntityManager,
  ): Promise<MarketplaceListingSourceRow | null> {
    const rows: unknown = await manager.query(
      `SELECT
         listing.id::text AS "listingId",
         listing.status::text AS "listingStatus",
         (listing.deleted_at IS NULL) AS "listingIsLive",
         estate.id::text AS "propertyId",
         estate.status::text AS "estateStatus",
         (estate.deleted_at IS NULL) AS "estateIsLive",
         estate.title AS title,
         estate.description AS description,
         estate.type::text AS type,
         estate.purpose::text AS purpose,
         estate.price::text AS price,
         estate.area::text AS area,
         estate.fk_province_id::text AS "provinceId",
         province.name AS "provinceName",
         estate.fk_ward_id::text AS "wardId",
         ward.name AS "wardName",
         estate.address_line AS address,
         estate.latitude::text AS latitude,
         estate.longitude::text AS longitude,
         to_char(listing.published_at AT TIME ZONE 'UTC', '${UTC_ISO_FORMAT}') AS "publishedAt",
         to_char(listing.updated_at AT TIME ZONE 'UTC', '${UTC_ISO_FORMAT}') AS "updatedAt"
       FROM tbl_listing listing
       LEFT JOIN tbl_estate estate ON estate.id = listing.fk_estate_id
       LEFT JOIN tbl_province province ON province.id = estate.fk_province_id
       LEFT JOIN tbl_ward ward ON ward.id = estate.fk_ward_id
       WHERE listing.id = $1`,
      [listingId],
    );
    const first = firstRecord(rows);
    return first === null ? null : parseSourceRow(first);
  }

  async loadImages(
    estateId: string,
    manager: EntityManager,
  ): Promise<string[]> {
    const rows: unknown = await manager.query(
      `SELECT media.media_url AS "mediaUrl"
       FROM tbl_media media
       WHERE media.fk_estate_id = $1
         AND media.deleted_at IS NULL
         AND media.type::text = 'image'
       ORDER BY media.sort_order ASC, media.id ASC
       LIMIT 20`,
      [estateId],
    );
    if (!Array.isArray(rows)) {
      throw new TypeError('PostgreSQL returned invalid Marketplace media rows');
    }
    return rows.map((row) => {
      const record = asRecord(row);
      if (typeof record.mediaUrl !== 'string') {
        throw new TypeError(
          'PostgreSQL returned an invalid Marketplace image URL',
        );
      }
      return record.mediaUrl;
    });
  }
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value)) {
    throw new TypeError(
      'PostgreSQL returned an invalid Marketplace source row',
    );
  }
  if (value.length === 0) return null;
  return asRecord(value[0]);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(
      'PostgreSQL returned an invalid Marketplace source row',
    );
  }
  return value as Record<string, unknown>;
}

function parseSourceRow(
  row: Record<string, unknown>,
): MarketplaceListingSourceRow {
  return {
    listingId: requiredString(row.listingId, 'listingId'),
    listingStatus: requiredString(row.listingStatus, 'listingStatus'),
    listingIsLive: requiredBoolean(row.listingIsLive, 'listingIsLive'),
    propertyId: nullableString(row.propertyId, 'propertyId'),
    estateStatus: nullableString(row.estateStatus, 'estateStatus'),
    estateIsLive:
      row.estateIsLive === null
        ? false
        : requiredBoolean(row.estateIsLive, 'estateIsLive'),
    title: nullableString(row.title, 'title'),
    description: nullableString(row.description, 'description'),
    type: nullableString(row.type, 'type'),
    purpose: nullableString(row.purpose, 'purpose'),
    price: nullableString(row.price, 'price'),
    area: nullableString(row.area, 'area'),
    provinceId: nullableString(row.provinceId, 'provinceId'),
    provinceName: nullableString(row.provinceName, 'provinceName'),
    wardId: nullableString(row.wardId, 'wardId'),
    wardName: nullableString(row.wardName, 'wardName'),
    address: nullableString(row.address, 'address'),
    latitude: nullableString(row.latitude, 'latitude'),
    longitude: nullableString(row.longitude, 'longitude'),
    publishedAt: nullableString(row.publishedAt, 'publishedAt'),
    updatedAt: nullableString(row.updatedAt, 'updatedAt'),
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`PostgreSQL returned invalid Marketplace ${field}`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field);
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`PostgreSQL returned invalid Marketplace ${field}`);
  }
  return value;
}
