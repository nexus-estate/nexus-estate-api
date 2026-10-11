import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DataSource, EntityManager } from 'typeorm';
import type { LocationFixture } from '../location-seed.type';

import {
  Province,
  Ward,
} from '../../../modules/location/administrative-division/entities/location.entity';
import { seedLocation } from './location.seed';

const loadFixture = async (): Promise<LocationFixture> =>
  JSON.parse(
    await readFile(join(__dirname, 'fixtures', 'location.v1.json'), 'utf-8'),
  ) as LocationFixture;

describe('location seed', () => {
  it('covers the 34 provinces and 3321 wards in the official two-level catalogue', async () => {
    const fixture = await loadFixture();
    const provinceCodes = new Set(fixture.provinces.map(({ code }) => code));
    const wardCodes = new Set(fixture.wards.map(({ code }) => code));

    expect(fixture.provinces).toHaveLength(34);
    expect(fixture.wards).toHaveLength(3321);
    expect(provinceCodes.size).toBe(34);
    expect(wardCodes.size).toBe(3321);
    expect(
      fixture.wards.every(({ provinceCode }) =>
        provinceCodes.has(provinceCode),
      ),
    ).toBe(true);
    expect(
      new Set(fixture.wards.map(({ provinceCode }) => provinceCode)),
    ).toEqual(provinceCodes);
    expect(fixture.provinces).toContainEqual({
      code: '79',
      name: 'Thành phố Hồ Chí Minh',
      type: 'municipality',
    });
    expect(fixture.wards).toContainEqual({
      code: '26740',
      name: 'Phường Sài Gòn',
      type: 'ward',
      provinceCode: '79',
    });
    expect(new Set(fixture.wards.map(({ type }) => type))).toEqual(
      new Set(['ward', 'commune', 'special_zone']),
    );
  });

  it('upserts provinces before wards with resolved province ids', async () => {
    const fixture = await loadFixture();
    const provinceUpsert = jest.fn().mockResolvedValue(undefined);
    const wardUpsert = jest.fn().mockResolvedValue(undefined);
    const provinces = fixture.provinces.map((province) => ({
      ...province,
      id: `id-${province.code}`,
    }));
    const manager = {
      getRepository: jest.fn((entity: typeof Province | typeof Ward) =>
        entity === Province
          ? {
              upsert: provinceUpsert,
              find: jest.fn().mockResolvedValue(provinces),
            }
          : { upsert: wardUpsert },
      ),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((run: (manager: EntityManager) => Promise<void>) =>
        run(manager),
      ),
    } as unknown as DataSource;
    const log = jest.spyOn(console, 'log').mockImplementation();

    try {
      await seedLocation(dataSource);
    } finally {
      log.mockRestore();
    }

    expect(provinceUpsert).toHaveBeenCalledWith(fixture.provinces, {
      conflictPaths: ['code'],
    });
    expect(wardUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          code: '26740',
          name: 'Phường Sài Gòn',
          type: 'ward',
          provinceId: 'id-79',
        },
      ]),
      { conflictPaths: ['code'] },
    );
    expect(wardUpsert).toHaveBeenCalledTimes(1);
    expect(provinceUpsert.mock.invocationCallOrder[0]).toBeLessThan(
      wardUpsert.mock.invocationCallOrder[0],
    );
  });
});
