import * as sourceModule from './helpers';

describe('helpers', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
