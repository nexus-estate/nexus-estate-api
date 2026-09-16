import { ProvinceRepo } from '../repositories/province.repo';
import { WardRepository } from '../repositories/ward.repo';
import { locationService } from './location.service';

describe('locationService', () => {
  it('lists provinces in repository order', async () => {
    const provinces = [{ id: 'province-id' }];
    const findAll = jest.fn().mockResolvedValue(provinces);
    const provinceRepository = {
      findAll,
    } as unknown as ProvinceRepo;
    const wardRepository = {} as WardRepository;

    await expect(
      new locationService(provinceRepository, wardRepository).getAllProvinces(),
    ).resolves.toBe(provinces);
    expect(findAll).toHaveBeenCalledWith();
  });

  it('lists wards scoped to one province', async () => {
    const provinceId = '30000000-0000-4000-8000-000000000001';
    const wards = [{ id: 'ward-id', provinceId }];
    const findByProvinceId = jest.fn().mockResolvedValue(wards);
    const provinceRepository = {} as ProvinceRepo;
    const wardRepository = {
      findByProvinceId,
    } as unknown as WardRepository;

    await expect(
      new locationService(
        provinceRepository,
        wardRepository,
      ).getWardsByProvinceId(provinceId),
    ).resolves.toBe(wards);
    expect(findByProvinceId).toHaveBeenCalledWith(provinceId);
  });
});
