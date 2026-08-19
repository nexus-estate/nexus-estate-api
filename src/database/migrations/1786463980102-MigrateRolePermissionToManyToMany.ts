import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableColumn,
} from 'typeorm';

export class RolePermissionManyToMany1786463980102 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tbl_role_permissions',
        columns: [
          {
            name: 'role_id',
            type: 'uuid',
            isNullable: false,
            isPrimary: true,
          },
          {
            name: 'permission_id',
            type: 'uuid',
            isNullable: false,
            isPrimary: true,
          },
        ],

        foreignKeys: [
          new TableForeignKey({
            name: 'fk_role_permissions_role',
            columnNames: ['role_id'],
            referencedTableName: 'tbl_role',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            name: 'fk_role_permissions_permission',
            columnNames: ['permission_id'],
            referencedTableName: 'tbl_permission',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({
            name: 'idx_role_permissions_permission_id',
            columnNames: ['permission_id'],
          }),
        ],
      }),
    );
    await queryRunner.query(`
        INSERT INTO tbl_role_permissions (role_id , permission_id)
        SELECT role_id , id
        FROM tbl_permission
    `);
    const permissionTable = await queryRunner.getTable('tbl_permission');
    if (!permissionTable) {
      throw new Error('Table tbl_permission does not exist');
    }
    const roleForeignKey = permissionTable.foreignKeys.find((foreikey) =>
      foreikey.columnNames.includes('role_id'),
    );
    if (!roleForeignKey) {
      throw new Error('cannot find roleForeignKey');
    }
    await queryRunner.dropForeignKey(permissionTable, roleForeignKey);
    const roleIndex = permissionTable.indices.find(
      (index) =>
        index.columnNames.length === 1 && index.columnNames[0] === 'role_id',
    );

    if (!roleIndex) {
      throw new Error('Index for tbl_permission.role_id does not exist');
    }
    await queryRunner.dropIndex(permissionTable, roleIndex);
    await queryRunner.dropColumn(permissionTable, 'role_id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT permission.id
        FROM tbl_permission AS permission
        LEFT JOIN tbl_role_permissions AS role_permission
          ON role_permission.permission_id = permission.id
        GROUP BY permission.id
        HAVING COUNT(role_permission.role_id) <> 1
     ) THEN
        RAISE EXCEPTION
         'Cannot restore one-to-many RBAC: every permission must belong to exactly one role';
     END IF;
    END
   $$;
  `);
    await queryRunner.addColumn(
      'tbl_permission',
      new TableColumn({
        name: 'role_id',
        type: 'uuid',
        isNullable: true,
      }),
    );
    await queryRunner.query(`
    UPDATE tbl_permission AS permission
    SET role_id = role_permission.role_id
    FROM tbl_role_permissions AS role_permission
    WHERE role_permission.permission_id = permission.id
`);
    await queryRunner.changeColumn(
      'tbl_permission',
      'role_id',
      new TableColumn({
        name: 'role_id',
        type: 'uuid',
        isNullable: false,
      }),
    );
    await queryRunner.createIndex(
      'tbl_permission',
      new TableIndex({
        name: 'idx_permission_role_id',
        columnNames: ['role_id'],
      }),
    );
    await queryRunner.createForeignKey(
      'tbl_permission',
      new TableForeignKey({
        name: 'fk_permission_role',
        columnNames: ['role_id'],
        referencedTableName: 'tbl_role',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.dropTable('tbl_role_permissions');
  }
}
