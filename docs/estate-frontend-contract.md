# Estate Frontend Contract

Tài liệu này là contract để FE dựng type, mock data và adapter render Estate.

## Trạng thái contract

- Contract Backend đã kiểm chứng từ `src/modules/estate/controller/estate.controller.ts`, entity và DTO.
- Các endpoint Estate hiện yêu cầu JWT.
- Hiện chưa có endpoint danh sách Estate công khai, pagination, filter, search hoặc media.
- `user`, `province`, `ward` được load trong response của `GET /estates/mine` và `GET /estates/:id`.
- FE không được giả định `approvalStatus`, `isFeatured`, `features`, `media` tồn tại trong response hiện tại.

## Enum

```ts
export type EstateType =
  | 'APARTMENT'
  | 'HOUSE'
  | 'VILLA'
  | 'TOWNHOUSE'
  | 'LAND'
  | 'OFFICE'
  | 'SHOPHOUSE'
  | 'WAREHOUSE'
  | 'COMMERCIAL'
  | 'HOTEL'
  | 'RESORT'
  | 'FARM'
  | 'OTHER';

export type EstatePurpose = 'SALE' | 'RENT' | 'SALE_OR_RENT';
export type ProvinceType = 'province' | 'municipality';
export type WardType = 'ward' | 'commune' | 'special_zone';
```

## Kiểu response

```ts
export type Estate = {
  id: string;
  userId: string;
  user: EstateUser;

  title: string;
  description: string | null;
  type: EstateType;
  purpose: EstatePurpose;

  // PostgreSQL bigint có thể được serialize thành string.
  price: string | number;

  // PostgreSQL decimal có thể được serialize thành string.
  area: string | number | null;
  latitude: string | number | null;
  longitude: string | number | null;

  bedrooms: number | null;
  bathrooms: number | null;
  floors: number | null;

  addressLine: string;
  provinceId: string;
  province: Province;
  wardId: string;
  ward: Ward;

  createdAt: string;
  updatedAt: string;
};

export type EstateUser = {
  id: string;
  email: string;
  roleId: string;
  isEmailVerified: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Province = {
  id: string;
  code: string;
  type: ProvinceType;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Ward = {
  id: string;
  code: string;
  name: string;
  type: WardType;
  provinceId: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiSuccess<T> = {
  status: true;
  data: T;
  timestamp: string;
  path: string;
};
```

## Payload tạo Estate

```ts
export type CreateEstateRequest = {
  title: string;
  description?: string;
  type: EstateType;
  purpose: EstatePurpose;
  price: number;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;
  addressLine: string;
  provinceId: string;
  wardId: string;
  latitude?: number;
  longitude?: number;
};

export type UpdateEstateRequest = Partial<CreateEstateRequest>;
```

Không gửi `id`, `userId`, `createdAt`, `updatedAt`, `deletedAt`, `createdBy` hoặc `updatedBy` trong request.

## Endpoint hiện có

```text
POST   /api/v1/estates             body: CreateEstateRequest       -> ApiSuccess<Estate>
GET    /api/v1/estates/mine                                        -> ApiSuccess<Estate[]>
GET    /api/v1/estates/:id                                         -> ApiSuccess<Estate>
PATCH  /api/v1/estates/:id          body: UpdateEstateRequest      -> ApiSuccess<Estate>
DELETE /api/v1/estates/:id                                         -> ApiSuccess<boolean>
```

## Mock Estate cho FE

```ts
export const mockEstate: Estate = {
  id: '8c1d8f2a-0e6f-4c55-9b5e-111111111111',
  userId: '7b2d8f2a-0e6f-4c55-9b5e-222222222222',
  title: 'Căn hộ 2 phòng ngủ view sông tại Thủ Thiêm',
  description: 'Căn hộ đầy đủ nội thất, ban công rộng, nhận nhà ngay.',
  type: 'APARTMENT',
  purpose: 'SALE',
  price: '4500000000',
  area: '72.50',
  bedrooms: 2,
  bathrooms: 2,
  floors: null,
  addressLine: '25 Mai Chí Thọ',
  provinceId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  wardId: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  latitude: '10.7756',
  longitude: '106.7218',
  user: {
    id: '7b2d8f2a-0e6f-4c55-9b5e-222222222222',
    email: 'broker@example.com',
    roleId: '9b2d8f2a-0e6f-4c55-9b5e-333333333333',
    isEmailVerified: true,
    lastLogin: '2026-09-10T08:00:00.000Z',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-09-10T08:00:00.000Z',
  },
  province: {
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    code: '79',
    type: 'municipality',
    name: 'Thành phố Hồ Chí Minh',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
  ward: {
    id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
    code: '26734',
    name: 'Phường An Khánh',
    type: 'ward',
    provinceId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
  createdAt: '2026-09-10T08:00:00.000Z',
  updatedAt: '2026-09-10T08:00:00.000Z',
};
```

FE nên chuyển `price`, `area`, `latitude`, `longitude` sang number trong adapter trước khi format hoặc tính toán.
