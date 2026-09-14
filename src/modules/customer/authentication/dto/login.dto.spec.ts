import * as sourceModule from './login.dto';

describe('login dto', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
