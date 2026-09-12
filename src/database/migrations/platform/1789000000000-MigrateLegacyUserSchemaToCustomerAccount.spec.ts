import { MigrateLegacyUserSchemaToCustomerAccount1789000000000 } from './1789000000000-MigrateLegacyUserSchemaToCustomerAccount';

describe('MigrateLegacyUserSchemaToCustomerAccount', () => {
  it('rejects ambiguous databases containing both legacy and current tables', async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
    };
    await expect(
      new MigrateLegacyUserSchemaToCustomerAccount1789000000000().up(
        runner as never,
      ),
    ).rejects.toThrow('tbl_user and tbl_customer_account both exist');
  });

  it('renames legacy customer and estate ownership columns when present', async () => {
    const runner = {
      hasTable: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true),
      renameTable: jest.fn(),
      getTable: jest
        .fn()
        .mockResolvedValueOnce({ foreignKeys: [{ name: 'fk_user_role' }] })
        .mockResolvedValueOnce({
          findColumnByName: (name: string) => name === 'fk_user_id',
        }),
      query: jest.fn().mockResolvedValue(undefined),
      renameColumn: jest.fn(),
    };

    await new MigrateLegacyUserSchemaToCustomerAccount1789000000000().up(
      runner as never,
    );
    expect(runner.renameTable).toHaveBeenCalledWith(
      'tbl_user',
      'tbl_customer_account',
    );
    expect(runner.renameColumn).toHaveBeenCalledWith(
      'tbl_estate',
      'fk_user_id',
      'fk_customer_id',
    );
  });

  it('is explicitly forward-only', async () => {
    await expect(
      new MigrateLegacyUserSchemaToCustomerAccount1789000000000().down(),
    ).rejects.toThrow('forward-only');
  });
});
