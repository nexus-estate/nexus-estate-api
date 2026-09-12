import * as sourceModule from './administration-authentication.controller';

describe('administration authentication controller', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
