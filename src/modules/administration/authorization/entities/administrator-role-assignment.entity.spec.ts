import { getMetadataArgsStorage } from 'typeorm';
import { AdministratorRoleAssignment } from './administrator-role-assignment.entity';

describe('AdministratorRoleAssignment entity', () => {
  it('models many-to-many administrator role assignments', () => {
    const primary = getMetadataArgsStorage()
      .columns.filter(
        (column) =>
          column.target === AdministratorRoleAssignment &&
          column.options.primary,
      )
      .map((column) => column.propertyName);
    expect(primary).toEqual(
      expect.arrayContaining(['administratorId', 'roleId']),
    );
    const relations = getMetadataArgsStorage()
      .relations.filter(
        (relation) => relation.target === AdministratorRoleAssignment,
      )
      .map((relation) => relation.propertyName);
    expect(relations).toEqual(
      expect.arrayContaining(['administrator', 'role']),
    );
  });
});
