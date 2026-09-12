import { getMetadataArgsStorage } from 'typeorm';
import { MarketplaceRole } from './marketplace-role.entity';

describe('MarketplaceRole entity', () => {
  it('has platform-local role identity and lifecycle metadata', () => {
    expect(
      getMetadataArgsStorage().tables.find(
        (table) => table.target === MarketplaceRole,
      )?.name,
    ).toBe('tbl_marketplace_role');
    const columns = getMetadataArgsStorage()
      .columns.filter((column) => column.target === MarketplaceRole)
      .map((column) => column.propertyName);
    expect(columns).toEqual(
      expect.arrayContaining(['code', 'isSystem', 'status', 'version']),
    );
  });
});
