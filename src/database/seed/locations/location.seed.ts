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

  if (
    typeof value.version !== 'number' ||
    !Number.isInteger(value.version) ||
    value.version < 1
  ) {
    return false;
  }

  if (
    !Array.isArray(value.provinces) ||
    !Array.isArray(value.wards) ||
    value.provinces.length === 0 ||
    value.wards.length === 0
  ) {
    return false;
  }

  const provincesValid = value.provinces.every((province: unknown) => {
    if (!isRecord(province)) {
      return false;
    }

    return (
      typeof province.code === 'string' &&
      /^\d{2}$/.test(province.code) &&
      typeof province.name === 'string' &&
      province.name.trim().length > 0 &&
      (province.type === 'province' || province.type === 'municipality')
    );
  });

  const wardsValid = value.wards.every((ward: unknown) => {
    if (!isRecord(ward)) {
      return false;
    }

    return (
      typeof ward.code === 'string' &&
      /^\d{5}$/.test(ward.code) &&
      typeof ward.name === 'string' &&
      ward.name.trim().length > 0 &&
      typeof ward.provinceCode === 'string' &&
      (ward.type === 'ward' ||
        ward.type === 'commune' ||
        ward.type === 'special_zone')
    );
  });

  if (!provincesValid || !wardsValid) {
    return false;
  }

  const provinces = value.provinces as LocationFixture['provinces'];
  const wards = value.wards as LocationFixture['wards'];
  const provinceCodes = provinces.map((province) => province.code);
  const wardCodes = wards.map((ward) => ward.code);
  const knownProvinceCodes = new Set(provinceCodes);

  return (
    knownProvinceCodes.size === provinceCodes.length &&
    new Set(wardCodes).size === wardCodes.length &&
    wards.every((ward) => knownProvinceCodes.has(ward.provinceCode))
  );
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

      console.log(
        `Seeded ${fixture.provinces.length} provinces and ${wards.length} wards`,
      );
    },
  );
};
