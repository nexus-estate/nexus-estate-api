import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('run location seed', () => {
  it('keeps the executable entrypoint beside its source', () => {
    expect(existsSync(resolve(__dirname, 'run-location-seed.ts'))).toBe(true);
  });
});
