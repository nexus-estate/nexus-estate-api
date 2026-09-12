import * as sourceModule from './estate.entity';

describe('estate entity', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
