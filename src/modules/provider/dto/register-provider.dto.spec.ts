import * as sourceModule from './register-provider.dto';

describe('register provider dto', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
