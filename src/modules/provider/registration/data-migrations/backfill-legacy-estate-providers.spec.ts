import * as sourceModule from './backfill-legacy-estate-providers';

describe('backfill legacy estate providers', () => {
  it('loads as an independent module boundary', () => {
    expect(sourceModule).toBeDefined();
  });
});
