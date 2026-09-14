import { MARKETPLACE_PERMISSION_REGISTRY } from './marketplace-permission.registry';

describe('marketplace permission registry', () => {
  it('does not invent baseline CUSTOMER RBAC permissions', () => {
    expect(MARKETPLACE_PERMISSION_REGISTRY).toEqual([]);
  });
});
