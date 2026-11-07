import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ExpandTypedEstateLocation1793864140180 } from '../../../src/modules/estate/property/migrations/1793864140180-ExpandTypedEstateLocation';
import { backfillTypedEstateLocations } from '../../../src/modules/estate/property/data-migrations/backfill-typed-estate-locations';

/** Minimal legacy schema keeps the migration and backfill assertions independent of app entities. */
describe('Typed estate locations (PostgreSQL)', () => {
  let container: StartedPostgreSqlContainer;
  let db: DataSource;
  const province = '10000000-0000-4000-8000-000000000001';
  const otherProvince = '10000000-0000-4000-8000-000000000002';
  const ward = '20000000-0000-4000-8000-000000000001';
  const commune = '20000000-0000-4000-8000-000000000002';
  const zone = '20000000-0000-4000-8000-000000000003';
  const estate = '30000000-0000-4000-8000-000000000001';
  const migration = new ExpandTypedEstateLocation1793864140180();

  async function migrate(direction: 'up' | 'down'): Promise<void> {
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await migration[direction](runner);
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_typed_location_test')
      .start();
    db = new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
    });
    await db.initialize();
  });
  afterAll(async () => {
    await db?.destroy();
    await container?.stop();
  });
  beforeEach(async () => {
    await db.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      CREATE TABLE tbl_ward(id uuid PRIMARY KEY, type varchar(20) NOT NULL, fk_province_id uuid NOT NULL);
      CREATE TABLE tbl_estate(id uuid PRIMARY KEY, fk_province_id uuid NOT NULL,
        fk_ward_id uuid NOT NULL REFERENCES tbl_ward(id), status text NOT NULL DEFAULT 'DRAFT',
        fk_provider_id uuid NOT NULL DEFAULT '40000000-0000-4000-8000-000000000001');`);
    await db.query(
      `INSERT INTO tbl_ward VALUES ($1,'ward',$4),($2,'commune',$4),($3,'special_zone',$4)`,
      [ward, commune, zone, province],
    );
  });

  it.each([
    ['ward', ward, 'fk_urban_ward_id'],
    ['commune', commune, 'fk_commune_id'],
    ['special_zone', zone, 'fk_special_zone_id'],
  ])(
    'backfills %s without changing identity, lifecycle or ownership and is idempotent',
    async (_type, id, field) => {
      await db.query(
        'INSERT INTO tbl_estate(id,fk_province_id,fk_ward_id) VALUES ($1,$2,$3)',
        [estate, province, id],
      );
      const before: Record<string, unknown>[] = await db.query(
        'SELECT * FROM tbl_estate',
      );
      await migrate('up');
      expect(await backfillTypedEstateLocations(db)).toBe(1);
      expect(await backfillTypedEstateLocations(db)).toBe(0);
      const rows: Record<string, unknown>[] = await db.query(
        'SELECT * FROM tbl_estate',
      );
      expect(rows[0]).toMatchObject({ ...before[0], [field]: id });
      expect(
        [
          rows[0].fk_urban_ward_id,
          rows[0].fk_commune_id,
          rows[0].fk_special_zone_id,
        ].filter(Boolean),
      ).toEqual([id]);
      await migrate('down');
      expect(await db.query('SELECT * FROM tbl_estate')).toEqual(before);
    },
  );

  it('synchronizes old writers when they switch from a ward to a commune', async () => {
    await migrate('up');
    await db.query(
      'INSERT INTO tbl_estate(id,fk_province_id,fk_ward_id) VALUES ($1,$2,$3)',
      [estate, province, ward],
    );
    await db.query('UPDATE tbl_estate SET fk_ward_id=$1 WHERE id=$2', [
      commune,
      estate,
    ]);
    expect(
      await db.query(
        'SELECT fk_urban_ward_id, fk_commune_id, fk_special_zone_id FROM tbl_estate',
      ),
    ).toEqual([
      {
        fk_urban_ward_id: null,
        fk_commune_id: commune,
        fk_special_zone_id: null,
      },
    ]);
  });

  it('accepts typed-only SQL inserts and rejects mixed, mismatched and cross-province selections', async () => {
    await migrate('up');
    await db.query(
      'INSERT INTO tbl_estate(id,fk_province_id,fk_commune_id) VALUES ($1,$2,$3)',
      [estate, province, commune],
    );
    expect(await db.query('SELECT fk_ward_id FROM tbl_estate')).toEqual([
      { fk_ward_id: commune },
    ]);
    await expect(
      db.query('UPDATE tbl_estate SET fk_urban_ward_id=$1 WHERE id=$2', [
        ward,
        estate,
      ]),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
    await expect(
      db.query(
        'UPDATE tbl_estate SET fk_commune_id=NULL,fk_urban_ward_id=$1 WHERE id=$2',
        [commune, estate],
      ),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
    await expect(
      db.query('UPDATE tbl_estate SET fk_province_id=$1 WHERE id=$2', [
        otherProvince,
        estate,
      ]),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
    await expect(
      db.query("UPDATE tbl_ward SET type='ward' WHERE id=$1", [commune]),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
    await expect(
      db.query('UPDATE tbl_ward SET fk_province_id=$1 WHERE id=$2', [
        otherProvince,
        commune,
      ]),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
  });

  it('rolls back the entire backfill if an existing address belongs to another province', async () => {
    await db.query(
      'INSERT INTO tbl_estate(id,fk_province_id,fk_ward_id) VALUES ($1,$2,$3)',
      [estate, otherProvince, commune],
    );
    await migrate('up');
    await expect(backfillTypedEstateLocations(db)).rejects.toMatchObject({
      driverError: { code: '23514' },
    });
    expect(await db.query('SELECT fk_commune_id FROM tbl_estate')).toEqual([
      { fk_commune_id: null },
    ]);
    await migrate('down');
    expect(await db.query('SELECT fk_ward_id FROM tbl_estate')).toEqual([
      { fk_ward_id: commune },
    ]);
  });
});
