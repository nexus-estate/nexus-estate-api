import {
  Province,
  Ward,
} from '../../../modules/location/administrative-division/entities/location.entity';
import { locationService } from './services/location.service';
import { locationController } from './location.controller';

describe('locationController', () => {
  it('returns provinces from the location service', async () => {
    const provinces = [{ id: 'province-id' }] as Province[];
    const getAllProvinces = jest.fn().mockResolvedValue(provinces);
    const service = {
      getAllProvinces,
      getWardsByProvinceId: jest.fn(),
    } as unknown as locationService;

    await expect(new locationController(service).getProvinces()).resolves.toBe(
      provinces,
    );
    expect(getAllProvinces).toHaveBeenCalledWith();
  });

  it('returns wards for the requested province', async () => {
    const provinceId = '30000000-0000-4000-8000-000000000001';
    const wards = [{ id: 'ward-id', provinceId }] as Ward[];
    const getWardsByProvinceId = jest.fn().mockResolvedValue(wards);
    const service = {
      getAllProvinces: jest.fn(),
      getWardsByProvinceId,
    } as unknown as locationService;

    await expect(
      new locationController(service).getWardsByProvince(provinceId),
    ).resolves.toBe(wards);
    expect(getWardsByProvinceId).toHaveBeenCalledWith(provinceId);
  });
});
