import { getMetadataArgsStorage } from 'typeorm';
import { AdministrationRole } from './administration-role.entity';

describe('AdministrationRole entity', () => {
  it('maps editable metadata and optimistic concurrency state', () => {
    const metadata = getMetadataArgsStorage();
    expect(
      metadata.tables.find((table) => table.target === AdministrationRole)
        ?.name,
    ).toBe('tbl_administration_role');
    const columns = metadata.columns
      .filter((column) => column.target === AdministrationRole)
      .map((column) => column.propertyName);
    expect(columns).toEqual(
      expect.arrayContaining(['code', 'isSystem', 'status', 'version']),
    );
  });
});
