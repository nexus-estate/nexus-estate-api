import { getMetadataArgsStorage } from 'typeorm';
import { CustomerRoleAssignment } from './customer-role-assignment.entity';

describe('CustomerRoleAssignment entity', () => {
  it('assigns platform roles to customers without a global user role', () => {
    const primary = getMetadataArgsStorage()
      .columns.filter(
        (column) =>
          column.target === CustomerRoleAssignment && column.options.primary,
      )
      .map((column) => column.propertyName);
    expect(primary).toEqual(expect.arrayContaining(['customerId', 'roleId']));
    expect(
      getMetadataArgsStorage().tables.find(
        (table) => table.target === CustomerRoleAssignment,
      )?.name,
    ).toBe('tbl_customer_role_assignment');
  });
});
