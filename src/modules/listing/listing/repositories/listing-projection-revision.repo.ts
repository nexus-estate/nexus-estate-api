import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

/** Performs atomic, timestamp-neutral increments for one Listing revision stream. */
@Injectable()
export class ListingProjectionRevisionRepo {
  /** Increments a live listing in the caller's transaction; missing rows return null. */
  async incrementProjectionRevision(
    listingId: string,
    manager: EntityManager,
  ): Promise<string | null> {
    const rows: unknown = await manager.query(
      `UPDATE tbl_listing
       SET projection_revision = projection_revision + 1
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING projection_revision::text AS projection_revision`,
      [listingId],
    );
    return this.getReturnedRevision(rows);
  }

  /** Increments the current live listing for an estate, if one exists. */
  async incrementProjectionRevisionByEstateId(
    estateId: string,
    manager: EntityManager,
  ): Promise<string | null> {
    const rows: unknown = await manager.query(
      `UPDATE tbl_listing
       SET projection_revision = projection_revision + 1
       WHERE fk_estate_id = $1 AND deleted_at IS NULL
       RETURNING projection_revision::text AS projection_revision`,
      [estateId],
    );
    return this.getReturnedRevision(rows);
  }

  private getReturnedRevision(result: unknown): string | null {
    // TypeORM exposes PostgreSQL UPDATE ... RETURNING as [rows, rowCount].
    const rows =
      Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row: unknown = rows[0];
    if (row === null || typeof row !== 'object') {
      throw new TypeError(
        'PostgreSQL returned an invalid listing revision row',
      );
    }
    const revision = (row as Record<string, unknown>).projection_revision;
    if (typeof revision !== 'string') {
      throw new TypeError(
        'PostgreSQL did not return a string listing revision',
      );
    }
    return revision;
  }
}
