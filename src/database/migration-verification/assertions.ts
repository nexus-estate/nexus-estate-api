import type { DataSource } from 'typeorm';

import {
  EXPECTED_FINAL_TABLES,
  SELLER_ACCOUNT_MIGRATION_TIMESTAMP,
} from './constants';

type CatalogRow = Record<string, string | null>;

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(`Migration verification failed: ${message}`);
  }
}

export async function assertAllMigrationsApplied(
  dataSource: DataSource,
): Promise<void> {
  assertCondition(
    !(await dataSource.showMigrations()),
    'all migrations should be applied after migration:run',
  );

  const migrationRows: CatalogRow[] = await dataSource.query(
    'SELECT timestamp FROM migrations',
  );
  assertCondition(
    migrationRows.length === dataSource.migrations.length,
    `expected ${dataSource.migrations.length} applied migrations, found ${migrationRows.length}`,
  );

  const sellerAccountMigration = migrationRows.find(
    (migration) => migration.timestamp === SELLER_ACCOUNT_MIGRATION_TIMESTAMP,
  );
  assertCondition(
    sellerAccountMigration,
    'SellerAccount migration should be recorded',
  );
}

export async function assertFinalTables(dataSource: DataSource): Promise<void> {
  const tableRows: CatalogRow[] = await dataSource.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ANY($1::text[])
    `,
    [EXPECTED_FINAL_TABLES],
  );
  const actualTables = new Set(tableRows.map((row) => row.table_name));

  for (const tableName of EXPECTED_FINAL_TABLES) {
    assertCondition(actualTables.has(tableName), `${tableName} should exist`);
  }
}

export async function assertSellerAccountSchema(
  dataSource: DataSource,
): Promise<void> {
  const columns: CatalogRow[] = await dataSource.query(`
    SELECT column_name, udt_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'tbl_seller_account'
  `);
  const columnByName = new Map(
    columns.map((column) => [column.column_name, column]),
  );

  assertCondition(
    columns.length === 11,
    'tbl_seller_account should have 11 columns',
  );
  for (const columnName of ['created_at', 'updated_at', 'deleted_at']) {
    const column = columnByName.get(columnName);
    assertCondition(column, `${columnName} should exist`);
    assertCondition(
      column.udt_name === 'timestamp',
      `${columnName} should use timestamp without time zone to match BaseEntity`,
    );
  }

  const indexes: CatalogRow[] = await dataSource.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'tbl_seller_account'
  `);
  const indexByName = new Map(
    indexes.map((index) => [index.indexname, index.indexdef]),
  );
  assertCondition(
    indexByName.get('uq_seller_account_owner_user_id')?.includes('UNIQUE'),
    'owner_user_id should have a unique index',
  );
  assertCondition(
    indexByName.has('idx_seller_account_status'),
    'status index should exist',
  );
  assertCondition(
    indexByName.has('idx_seller_account_type'),
    'type index should exist',
  );

  const foreignKeys: CatalogRow[] = await dataSource.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'tbl_seller_account'::regclass
      AND contype = 'f'
  `);
  const ownerForeignKey = foreignKeys.find(
    (foreignKey) => foreignKey.conname === 'fk_seller_account_owner_user',
  );
  assertCondition(ownerForeignKey, 'owner_user_id foreign key should exist');
  assertCondition(
    ownerForeignKey.definition?.includes('REFERENCES tbl_user(id)'),
    'owner_user_id foreign key should reference tbl_user(id)',
  );

  const checkConstraints: CatalogRow[] = await dataSource.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'tbl_seller_account'::regclass
      AND contype = 'c'
  `);
  const checkNames = new Set(
    checkConstraints.map((constraint) => constraint.conname),
  );
  for (const constraintName of [
    'chk_seller_account_type',
    'chk_seller_account_status',
    'chk_seller_account_verification_status',
  ]) {
    assertCondition(
      checkNames.has(constraintName),
      `${constraintName} should exist`,
    );
  }
}

export async function assertMigrationDatabase(
  dataSource: DataSource,
): Promise<void> {
  await assertAllMigrationsApplied(dataSource);
  await assertFinalTables(dataSource);
  await assertSellerAccountSchema(dataSource);
}
