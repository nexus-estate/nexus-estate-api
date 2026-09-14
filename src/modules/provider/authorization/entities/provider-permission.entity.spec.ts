import { getMetadataArgsStorage } from 'typeorm';
import { ProviderPermission } from './provider-permission.entity';

describe('ProviderPermission entity', () => {
  it('stores provider capability semantics rather than user types', () => {
    const columns = getMetadataArgsStorage()
      .columns.filter((column) => column.target === ProviderPermission)
      .map((column) => column.options.name ?? column.propertyName);
    expect(columns).toEqual(
      expect.arrayContaining([
        'code',
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
