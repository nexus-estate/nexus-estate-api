import type { DataSource, MigrationInterface } from 'typeorm';

type MigrationMetadataRow = {
  name: string;
  timestamp: string | number;
};

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(`Migration verification failed: ${message}`);
  }
}

function getMigrationName(migration: MigrationInterface): string {
  const migrationWithName = migration as MigrationInterface & {
    name?: string;
  };

  return migrationWithName.name || migration.constructor.name;
}

export function assertMigrationMetadata(dataSource: DataSource): void {
  const migrationNames = dataSource.migrations.map(getMigrationName);
  assertCondition(
    migrationNames.every((name) => name.length > 0),
    'every discovered migration should have a class name',
  );
  assertCondition(
    new Set(migrationNames).size === migrationNames.length,
    'discovered migration names should be unique',
  );
}

export async function assertAllMigrationsApplied(
  dataSource: DataSource,
): Promise<void> {
  assertCondition(
    !(await dataSource.showMigrations()),
    'all discovered migrations should be applied after migration:run',
  );

  const migrationRows: MigrationMetadataRow[] = await dataSource.query(
    'SELECT name, timestamp FROM migrations ORDER BY id',
  );
  const discoveredMigrationNames = new Set(
    dataSource.migrations.map(getMigrationName),
  );

  assertCondition(
    migrationRows.length === dataSource.migrations.length,
    `expected ${dataSource.migrations.length} applied migrations, found ${migrationRows.length}`,
  );
  assertCondition(
    new Set(migrationRows.map((migration) => migration.name)).size ===
      migrationRows.length,
    'applied migration names should be unique',
  );
  assertCondition(
    migrationRows.every((migration) =>
      discoveredMigrationNames.has(migration.name),
    ),
    'every applied migration should be present in the discovered migration set',
  );

  for (let index = 1; index < migrationRows.length; index += 1) {
    assertCondition(
      Number(migrationRows[index].timestamp) >=
        Number(migrationRows[index - 1].timestamp),
      'applied migrations should be ordered by timestamp',
    );
  }
}
