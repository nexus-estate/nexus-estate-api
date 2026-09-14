import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import type { DataSource, MigrationInterface } from 'typeorm';

import { assertMigrationMetadata } from './helpers';

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(entryPath) : [entryPath];
  });
}

/** Discovers source migration class identities without requiring a database. */
function discoverSourceMigrations(): MigrationInterface[] {
  const modulesRoot = join(__dirname, '..', '..', 'modules');
  return filesUnder(modulesRoot)
    .filter(
      (file) =>
        file.includes(`${sep}migrations${sep}`) &&
        file.endsWith('.ts') &&
        !/\.(spec|test)\.ts$/.test(file),
    )
    .map((file) => {
      const fileName = file.split(sep).pop() ?? '';
      const fileMatch = /^(\d{13})-[A-Za-z][A-Za-z0-9]*\.ts$/.exec(fileName);
      const source = readFileSync(file, 'utf8');
      const classMatch = /export class ([A-Za-z0-9_]+\d{13})\b/.exec(source);
      if (!fileMatch || !classMatch || !classMatch[1].endsWith(fileMatch[1])) {
        throw new Error(`Invalid migration identity: ${file}`);
      }
      return { name: classMatch[1] } as MigrationInterface;
    });
}

/**
 * Performs the cheap source/compiled migration identity check without opening
 * a database. CI and local development use it to reject new timestamp
 * collisions before a migration can reach a shared environment.
 */
function checkMigrationTimestamps(): void {
  const dataSource = {
    migrations: discoverSourceMigrations(),
  } as DataSource;
  assertMigrationMetadata(dataSource);
  console.log(
    `Migration timestamp check passed: ${dataSource.migrations.length} unique identities`,
  );
}

try {
  checkMigrationTimestamps();
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
