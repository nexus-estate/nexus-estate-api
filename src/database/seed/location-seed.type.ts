export interface LocationProvinceFixture {
  code: string;
  name: string;
  type: 'province' | 'municipality';
}

export interface LocationWardFixture {
  code: string;
  name: string;
  type: 'ward' | 'commune' | 'special_zone';
  provinceCode: string;
}

export interface LocationFixture {
  version: number;
  provinces: LocationProvinceFixture[];
  wards: LocationWardFixture[];
}
