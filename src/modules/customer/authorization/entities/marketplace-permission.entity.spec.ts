import { getMetadataArgsStorage } from 'typeorm';
import { MarketplacePermission } from './marketplace-permission.entity';

describe('MarketplacePermission entity', () => {
  it('exposes grouped permission metadata and deprecation state', () => {
    const columns = getMetadataArgsStorage()
      .columns.filter((column) => column.target === MarketplacePermission)
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
