import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DataSource, EntityManager } from 'typeorm';
import type { LocationFixture } from '../location-seed.type';

import {
  Province,
  Ward,
} from '../../../modules/location/administrative-division/entities/location.entity';
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isLocationFixture = (value: unknown): value is LocationFixture => {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.version !== 'number') {
    return false;
  }

  if (!Array.isArray(value.provinces) || !Array.isArray(value.wards)) {
    return false;
  }

  const provincesValid = value.provinces.every((province: unknown) => {
    if (!isRecord(province)) {
      return false;
    }

    return (
      typeof province.code === 'string' &&
      typeof province.name === 'string' &&
      (province.type === 'province' || province.type === 'municipality')
    );
  });

  const wardsValid = value.wards.every((ward: unknown) => {
    if (!isRecord(ward)) {
      return false;
    }

    return (
      typeof ward.code === 'string' &&
      typeof ward.name === 'string' &&
      typeof ward.provinceCode === 'string' &&
      (ward.type === 'ward' ||
        ward.type === 'commune' ||
        ward.type === 'special_zone')
    );
  });

  return provincesValid && wardsValid;
};

const loadLocationFixture = async (): Promise<LocationFixture> => {
  const fixturePath = join(__dirname, 'fixtures', 'location.v1.json');

  const content = await readFile(fixturePath, 'utf-8');

  const parsed: unknown = JSON.parse(content);

  if (!isLocationFixture(parsed)) {
    throw new Error('Invalid location fixture format');
  }

  return parsed;
};

export const seedLocation = async (dataSource: DataSource): Promise<void> => {
  await dataSource.transaction(
    async (manager: EntityManager): Promise<void> => {
      const fixture = await loadLocationFixture();

      const provinceRepository = manager.getRepository(Province);

      await provinceRepository.upsert(fixture.provinces, {
        conflictPaths: ['code'],
      });
      const provinces = await provinceRepository.find();

      const provinceIdByCode = new Map<string, string>(
        provinces.map((province) => [province.code, province.id]),
      );

      const wards = fixture.wards.map((ward) => {
        const provinceId = provinceIdByCode.get(ward.provinceCode);

        if (!provinceId) {
          throw new Error(
            `Province code ${ward.provinceCode} not found for ward ${ward.code}`,
          );
        }

        return {
          code: ward.code,
          name: ward.name,
          type: ward.type,
          provinceId,
        };
      });

      const wardRepository = manager.getRepository(Ward);

      await wardRepository.upsert(wards, {
        conflictPaths: ['code'],
      });

      console.log(`Seeded ${fixture.provinces.length} provinces`);
      console.log(
        `Seeded ${fixture.provinces.length} provinces and ${wards.length} wards`,
      );
    },
  );
};
