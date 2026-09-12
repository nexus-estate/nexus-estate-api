import { CreateAdministrationAuthorizationTables1789400000000 } from './1789400000000-CreateAdministrationAuthorizationTables';

describe('CreateAdministrationAuthorizationTables', () => {
  it('creates scoped administration tables and bootstraps internal roles', async () => {
    const createTable = jest.fn().mockResolvedValue(undefined);
    const query = jest.fn().mockResolvedValue(undefined);
    const runner = {
      createTable,
      query,
      hasTable: jest.fn().mockResolvedValue(true),
    };

    await new CreateAdministrationAuthorizationTables1789400000000().up(
      runner as never,
    );
    expect(createTable).toHaveBeenCalledTimes(4);
    expect(query.mock.calls.map(([sql]) => String(sql)).join('\n')).toContain(
      'SUPER_ADMIN',
    );
    expect(query.mock.calls.map(([sql]) => String(sql)).join('\n')).toContain(
      'PROVIDER_REVIEWER',
    );
  });

  it('can remove only the tables owned by the migration on down', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const dropTable = jest.fn().mockResolvedValue(undefined);
    await new CreateAdministrationAuthorizationTables1789400000000().down({
      query,
      dropTable,
    } as never);
    expect(dropTable).toHaveBeenCalledWith(
      'tbl_administrator_role_assignment',
      true,
      true,
      true,
    );
  });
});
