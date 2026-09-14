import { getMetadataArgsStorage } from 'typeorm';
import { AdministrationRolePermission } from './administration-role-permission.entity';

describe('AdministrationRolePermission entity', () => {
  it('uses a composite role-permission key', () => {
    const primary = getMetadataArgsStorage()
      .columns.filter(
        (column) =>
          column.target === AdministrationRolePermission &&
          column.options.primary,
      )
      .map((column) => column.propertyName);
    expect(primary).toEqual(expect.arrayContaining(['roleId', 'permissionId']));
  });
});
