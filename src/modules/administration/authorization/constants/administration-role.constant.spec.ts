import { ADMINISTRATION_ROLES } from './administration-role.constant';

describe('ADMINISTRATION_ROLES', () => {
  it('defines only internal administration roles', () => {
    expect(ADMINISTRATION_ROLES).toEqual({
      SUPER_ADMIN: 'SUPER_ADMIN',
      PROVIDER_REVIEWER: 'PROVIDER_REVIEWER',
    });
  });
});
