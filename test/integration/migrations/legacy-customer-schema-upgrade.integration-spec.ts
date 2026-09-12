import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { MigrateLegacyUserSchemaToCustomerAccount1789000000000 } from '../../../src/database/migrations/platform/1789000000000-MigrateLegacyUserSchemaToCustomerAccount';

jest.setTimeout(120_000);

describe('legacy User -> CustomerAccount schema upgrade', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('nexus_estate_upgrade_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  beforeEach(async () => {
    await dataSource.query('DROP TABLE IF EXISTS tbl_estate CASCADE');
    await dataSource.query('DROP TABLE IF EXISTS tbl_customer_account CASCADE');
    await dataSource.query('DROP TABLE IF EXISTS tbl_user CASCADE');
    await dataSource.query('DROP TABLE IF EXISTS tbl_role CASCADE');

    await dataSource.query(`
      CREATE TABLE tbl_role (
        id uuid PRIMARY KEY,
        name varchar NOT NULL
      )
    `);
    await dataSource.query(`
      CREATE TABLE tbl_user (
        id uuid PRIMARY KEY,
        email varchar NOT NULL,
        password varchar NOT NULL,
        role_id uuid NOT NULL,
        CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES tbl_role(id)
      )
    `);
    await dataSource.query(`
      CREATE TABLE tbl_estate (
        id uuid PRIMARY KEY,
        fk_user_id uuid NOT NULL,
        CONSTRAINT fk_estate_user_id FOREIGN KEY (fk_user_id) REFERENCES tbl_user(id)
      )
    `);

    await dataSource.query(
      `INSERT INTO tbl_role (id, name) VALUES ('10000000-0000-4000-8000-000000000001', 'customer')`,
    );
    await dataSource.query(
      `INSERT INTO tbl_user (id, email, password, role_id) VALUES ('20000000-0000-4000-8000-000000000001', 'legacy@nexus.test', 'hash', '10000000-0000-4000-8000-000000000001')`,
    );
    await dataSource.query(
      `INSERT INTO tbl_estate (id, fk_user_id) VALUES ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')`,
    );
  });

  it('renames legacy identity and estate ownership without losing data', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await new MigrateLegacyUserSchemaToCustomerAccount1789000000000().up(
        queryRunner,
      );
    } finally {
      await queryRunner.release();
    }

    expect(await dataSource.query(`SELECT to_regclass('tbl_user') AS table_name`))
      .toEqual([{ table_name: null }]);
    expect(
      await dataSource.query(
        `SELECT to_regclass('tbl_customer_account') AS table_name`,
      ),
    ).toEqual([{ table_name: 'tbl_customer_account' }]);

    const customers = await dataSource.query<
      Array<{ id: string; email: string }>
    >('SELECT id, email FROM tbl_customer_account');
    expect(customers).toEqual([
      {
        id: '20000000-0000-4000-8000-000000000001',
        email: 'legacy@nexus.test',
      },
    ]);

    const estateColumns = await dataSource.query<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'tbl_estate'`,
    );
    expect(estateColumns.map((column) => column.column_name)).toContain(
      'fk_customer_id',
    );
    expect(estateColumns.map((column) => column.column_name)).not.toContain(
      'fk_user_id',
    );

    const estates = await dataSource.query<Array<{ fk_customer_id: string }>>(
      'SELECT fk_customer_id FROM tbl_estate',
    );
    expect(estates).toEqual([
      { fk_customer_id: '20000000-0000-4000-8000-000000000001' },
    ]);

    const constraints = await dataSource.query<Array<{ conname: string }>>(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'tbl_customer_account'::regclass
    `);
    expect(constraints.map((constraint) => constraint.conname)).toContain(
      'fk_customer_account_role',
    );
  });

  it('is a no-op when the database already uses the CustomerAccount schema', async () => {
    await dataSource.query('DROP TABLE tbl_estate CASCADE');
    await dataSource.query('ALTER TABLE tbl_user RENAME TO tbl_customer_account');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await expect(
        new MigrateLegacyUserSchemaToCustomerAccount1789000000000().up(
          queryRunner,
        ),
      ).resolves.toBeUndefined();
    } finally {
      await queryRunner.release();
    }
  });
});
