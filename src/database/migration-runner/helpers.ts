import type { DataSource, MigrationInterface } from 'typeorm';

type MigrationMetadataRow = {
  name: string;
  timestamp: string | number;
};

/**
 * Historical identities were normalized before this fresh-database baseline,
 * so no collision is currently allowed. If a deployed legacy collision must
 * remain in a future branch, list the exact migration names here explicitly;
 * every new collision must still fail verification.
 */
export const LEGACY_MIGRATION_TIMESTAMP_COLLISION_ALLOWLIST = new Set<string>();

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

/** Rejects timestamp collisions unless every colliding identity is explicitly legacy. */
export function assertMigrationTimestamps(dataSource: DataSource): void {
  const migrationsByTimestamp = new Map<number, string[]>();
  for (const migration of dataSource.migrations) {
    const name = getMigrationName(migration);
    const timestampMatch = /(\d{13})$/.exec(name);
    assertCondition(
      Boolean(timestampMatch),
      `migration ${name} should end with a 13-digit timestamp`,
    );
    const timestamp = Number(timestampMatch?.[1]);
    const names = migrationsByTimestamp.get(timestamp) ?? [];
    names.push(name);
    migrationsByTimestamp.set(timestamp, names);
  }

  for (const [timestamp, names] of migrationsByTimestamp) {
    if (names.length < 2) continue;
    const isAllowedLegacyCollision = names.every((name) =>
      LEGACY_MIGRATION_TIMESTAMP_COLLISION_ALLOWLIST.has(name),
    );
    assertCondition(
      isAllowedLegacyCollision,
      `migration timestamp ${timestamp} is duplicated by ${names.join(', ')}`,
    );
  }
}

/** Verifies that a data source is configured for deterministic migration execution. */
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
  assertMigrationTimestamps(dataSource);
}

/** Fails verification when the compiled data source has undiscovered pending migrations. */
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
