import { getMetadataArgsStorage } from 'typeorm';
import { ProviderMembershipRole } from './provider-membership-role.entity';

describe('ProviderMembershipRole entity', () => {
  it('assigns roles to memberships, not directly to customer identities', () => {
    const primary = getMetadataArgsStorage()
      .columns.filter(
        (column) =>
          column.target === ProviderMembershipRole && column.options.primary,
      )
      .map((column) => column.propertyName);
    expect(primary).toEqual(expect.arrayContaining(['membershipId', 'roleId']));
    const relations = getMetadataArgsStorage()
      .relations.filter(
        (relation) => relation.target === ProviderMembershipRole,
      )
      .map((relation) => relation.propertyName);
    expect(relations).toEqual(expect.arrayContaining(['membership', 'role']));
  });
});
