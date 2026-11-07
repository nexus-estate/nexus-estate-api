import type { DataSource } from 'typeorm';

/** Backfills typed fields atomically without changing canonical IDs, lifecycle or ownership. */
export async function backfillTypedEstateLocations(
  dataSource: DataSource,
): Promise<number> {
  return dataSource.transaction(async (manager) => {
    const rows: { count: string }[] = await manager.query(`
      WITH updated AS (UPDATE tbl_estate SET fk_ward_id = fk_ward_id
      WHERE num_nonnulls(fk_urban_ward_id, fk_commune_id, fk_special_zone_id) = 0
      RETURNING id) SELECT count(*)::text AS count FROM updated
    `);
    await manager.query(
      'ALTER TABLE tbl_estate VALIDATE CONSTRAINT ck_estate_one_typed_location',
    );
    return Number(rows[0].count);
  });
}
