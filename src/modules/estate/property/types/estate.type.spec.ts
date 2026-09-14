import * as sourceModule from './estate.type';

describe('estate type', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
