import { getMetadataArgsStorage } from 'typeorm';
import { ProviderMembership } from './provider-membership.entity';

describe('ProviderMembership entity', () => {
  it('binds a customer to a provider with lifecycle state', () => {
    expect(
      getMetadataArgsStorage().tables.find(
        (table) => table.target === ProviderMembership,
      )?.name,
    ).toBe('tbl_provider_membership');
    const columns = getMetadataArgsStorage()
      .columns.filter((column) => column.target === ProviderMembership)
      .map((column) => column.options.name ?? column.propertyName);
    expect(columns).toEqual(
      expect.arrayContaining([
        'provider_id',
        'customer_id',
        'status',
        'joined_at',
      ]),
    );
    expect(
      getMetadataArgsStorage().indices.some(
        (index) => index.target === ProviderMembership && index.unique,
      ),
    ).toBe(true);
  });
});
