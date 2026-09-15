import * as sourceModule from './rbac-error-codes';

describe('rbac error codes', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
