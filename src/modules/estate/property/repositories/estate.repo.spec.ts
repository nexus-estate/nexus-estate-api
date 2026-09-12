import * as sourceModule from './estate.repo';

describe('estate repo', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
