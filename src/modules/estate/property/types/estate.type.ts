import { CreateEstateDto } from '../dto/create-estate-dto';

export enum EstateType {
  APARTMENT = 'APARTMENT',
  HOUSE = 'HOUSE',
  VILLA = 'VILLA',
  TOWNHOUSE = 'TOWNHOUSE',
  LAND = 'LAND',
  OFFICE = 'OFFICE',
  SHOPHOUSE = 'SHOPHOUSE',
  WAREHOUSE = 'WAREHOUSE',
  COMMERCIAL = 'COMMERCIAL',
  HOTEL = 'HOTEL',
  RESORT = 'RESORT',
  FARM = 'FARM',
  OTHER = 'OTHER',
}

export enum EstatePurpose {
  SALE = 'SALE',
  RENT = 'RENT',
  SALE_OR_RENT = 'SALE_OR_RENT',
}

/** Provider is the canonical Estate owner; customer id is provenance only. */
export type CreateEstateData = CreateEstateDto & {
  customerId: string;
  providerId: string;
};
