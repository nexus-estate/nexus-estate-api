import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';

import { assertMigrationDatabase } from './migration-verification/assertions';
import { createTypeOrmDataSource } from './type.config';

const adminDatabase = process.env.DB_POSTGRES_ADMIN_NAME || 'postgres';

function assertValidIdentifier(identifier: string): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid generated database identifier: ${identifier}`);
  }
}

function quoteIdentifier(identifier: string): string {
  assertValidIdentifier(identifier);
  return `"${identifier}"`;
}

function createVerificationDatabaseName(): string {
  const databaseName = `migration_verify_${Date.now()}_${process.pid}_${randomUUID().slice(0, 8)}`;
  assertValidIdentifier(databaseName);
  return databaseName;
}

async function verifyMigrations(): Promise<void> {
  const databaseName = createVerificationDatabaseName();
  const adminDataSource = createTypeOrmDataSource(adminDatabase);
  let verificationDataSource: DataSource | undefined;
  let adminInitialized = false;
  let verificationInitialized = false;
  let databaseCreated = false;

  try {
    await adminDataSource.initialize();
    adminInitialized = true;
    await adminDataSource.query(
      `CREATE DATABASE ${quoteIdentifier(databaseName)}`,
    );
    databaseCreated = true;

    verificationDataSource = createTypeOrmDataSource(databaseName);
    await verificationDataSource.initialize();
    verificationInitialized = true;

    const executedMigrations = await verificationDataSource.runMigrations();
    if (
      executedMigrations.length !== verificationDataSource.migrations.length
    ) {
      throw new Error(
        `Migration verification failed: expected ${verificationDataSource.migrations.length} migrations to run, found ${executedMigrations.length}`,
      );
    }
    await assertMigrationDatabase(verificationDataSource);

    await verificationDataSource.undoLastMigration();
    const sellerAccountTableAfterRevert: unknown[] =
      await verificationDataSource.query(`
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'tbl_seller_account'
      `);
    if (sellerAccountTableAfterRevert.length !== 0) {
      throw new Error(
        'Migration verification failed: reverting the latest migration should remove tbl_seller_account',
      );
    }

    await verificationDataSource.runMigrations();
    await assertMigrationDatabase(verificationDataSource);
    console.log(
      `Migration verification passed on ${databaseName}: fresh create -> run all -> assert -> revert -> run all -> assert -> drop`,
    );
  } finally {
    if (verificationInitialized) {
      await verificationDataSource?.destroy();
    }

    try {
      if (databaseCreated && adminInitialized) {
        await adminDataSource.query(
          `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`,
        );
      }
    } finally {
      if (adminInitialized) {
        await adminDataSource.destroy();
      }
    }
  }
}

verifyMigrations().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
