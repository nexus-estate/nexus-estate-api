import { getMetadataArgsStorage } from 'typeorm';
import { ProviderRolePermission } from './provider-role-permission.entity';

describe('ProviderRolePermission entity', () => {
  it('keeps provider role mappings platform-local and unique', () => {
    const primary = getMetadataArgsStorage()
      .columns.filter(
        (column) =>
          column.target === ProviderRolePermission && column.options.primary,
      )
      .map((column) => column.propertyName);
    expect(primary).toEqual(expect.arrayContaining(['roleId', 'permissionId']));
  });
});
