import type { DataSource } from 'typeorm';

import { assertMigrationMetadata, assertMigrationTimestamps } from './helpers';

describe('helpers', () => {
  it('accepts unique 13-digit migration identities', () => {
    const dataSource = {
      migrations: [
        { name: 'FirstMigration1789312966656' },
        { name: 'SecondMigration1789312966657' },
      ],
    } as DataSource;

    expect(() => assertMigrationMetadata(dataSource)).not.toThrow();
  });

  it('rejects a new timestamp collision', () => {
    const dataSource = {
      migrations: [
        { name: 'FirstMigration1789312966656' },
        { name: 'SecondMigration1789312966656' },
      ],
    } as DataSource;

    expect(() => assertMigrationTimestamps(dataSource)).toThrow(
      'migration timestamp 1789312966656 is duplicated',
    );
  });
});
