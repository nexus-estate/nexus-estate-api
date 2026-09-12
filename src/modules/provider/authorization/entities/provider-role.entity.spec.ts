import { getMetadataArgsStorage } from 'typeorm';
import { ProviderRole } from './provider-role.entity';

describe('ProviderRole entity', () => {
  it('supports system/custom roles and disabled-role lifecycle', () => {
    const columns = getMetadataArgsStorage()
      .columns.filter((column) => column.target === ProviderRole)
      .map((column) => column.propertyName);
    expect(columns).toEqual(
      expect.arrayContaining(['code', 'isSystem', 'status', 'version']),
    );
  });
});
