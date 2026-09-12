import { getMetadataArgsStorage } from 'typeorm';
import { AdministrationPermission } from './administration-permission.entity';

describe('AdministrationPermission entity', () => {
  it('maps the platform-owned permission catalogue', () => {
    const metadata = getMetadataArgsStorage();
    expect(
      metadata.tables.find((table) => table.target === AdministrationPermission)
        ?.name,
    ).toBe('tbl_administration_permission');
    const columns = metadata.columns
      .filter((column) => column.target === AdministrationPermission)
      .map((column) => column.options.name ?? column.propertyName);
    expect(columns).toEqual(
      expect.arrayContaining([
        'code',
        'name',
        'category',
        'resource',
        'action',
        'risk_level',
        'is_assignable',
        'deprecated_at',
      ]),
    );
  });
});
