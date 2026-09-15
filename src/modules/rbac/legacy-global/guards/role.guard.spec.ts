import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RoleGuard } from './role.guard';
import { ROLES } from '../../../../utils/constants/role.constant';

function createContext(user?: { role: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
}

describe('RoleGuard', () => {
  it('allows a principal with one required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([ROLES.PROVIDER]),
    } as unknown as Reflector;
    const guard = new RoleGuard(reflector);

    expect(guard.canActivate(createContext({ role: ROLES.PROVIDER }))).toBe(
      true,
    );
    expect(guard.canActivate(createContext({ role: ROLES.CUSTOMER }))).toBe(
      false,
    );
  });

  it('allows any role in a multi-role requirement', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([ROLES.ADMINISTRATOR, ROLES.PROVIDER]),
    } as unknown as Reflector;
    const guard = new RoleGuard(reflector);

    expect(
      guard.canActivate(createContext({ role: ROLES.ADMINISTRATOR })),
    ).toBe(true);
    expect(guard.canActivate(createContext({ role: ROLES.CUSTOMER }))).toBe(
      false,
    );
  });
});
