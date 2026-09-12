import * as sourceModule from './administration-authentication.service';

describe('administration authentication service', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
