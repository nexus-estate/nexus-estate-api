import { getMetadataArgsStorage } from 'typeorm';
import { MarketplaceRolePermission } from './marketplace-role-permission.entity';

describe('MarketplaceRolePermission entity', () => {
  it('prevents duplicate role-permission mappings with a composite key', () => {
    const primary = getMetadataArgsStorage()
      .columns.filter(
        (column) =>
          column.target === MarketplaceRolePermission && column.options.primary,
      )
      .map((column) => column.propertyName);
    expect(primary).toEqual(expect.arrayContaining(['roleId', 'permissionId']));
  });
});
