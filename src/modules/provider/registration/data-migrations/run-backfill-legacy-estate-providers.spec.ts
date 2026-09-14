import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('run backfill legacy estate providers', () => {
  it('keeps the executable entrypoint beside its source', () => {
    expect(
      existsSync(resolve(__dirname, 'run-backfill-legacy-estate-providers.ts')),
    ).toBe(true);
  });
});
