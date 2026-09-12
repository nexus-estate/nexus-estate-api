import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AuthorizationPermissionListQueryDto,
  CreateAuthorizationRoleDto,
  ReplaceRolePermissionsDto,
} from './authorization-management.dto';

describe('authorization management DTOs', () => {
  it('accepts a bounded upper-snake-case role request', async () => {
    const dto = plainToInstance(CreateAuthorizationRoleDto, {
      code: 'SUPPORT_AGENT',
      name: 'Support Agent',
      permissionIds: [],
    });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects invalid role codes and duplicate or oversized permission sets', async () => {
    const invalidRole = plainToInstance(CreateAuthorizationRoleDto, {
      code: 'support-agent',
      name: 'Support Agent',
      permissionIds: [],
    });
    const invalidPermissions = plainToInstance(ReplaceRolePermissionsDto, {
      permissionIds: ['not-a-uuid', 'not-a-uuid'],
      expectedVersion: 0,
    });
    expect((await validate(invalidRole)).length).toBeGreaterThan(0);
    expect((await validate(invalidPermissions)).length).toBeGreaterThan(0);
  });

  it('parses false query flags as false rather than JavaScript truthy strings', () => {
    const dto = plainToInstance(AuthorizationPermissionListQueryDto, {
      isAssignable: 'false',
      includeDeprecated: 'false',
    });
    expect(dto.isAssignable).toBe(false);
    expect(dto.includeDeprecated).toBe(false);
  });
});
