import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApprovalBaseEntity } from '../../../services/abstraction-services';
import { User } from '../../user/entities/user.entity';
import { Province, Ward } from '../../location/entities/location.entity';

export enum PropertyType {
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

export enum PropertyPurpose {
  SALE = 'SALE',
  RENT = 'RENT',
  SALE_OR_RENT = 'SALE_OR_RENT',
}

export interface PropertyFeatures {
  hasBalcony?: boolean;
  hasGarage?: boolean;
  hasGarden?: boolean;
  hasPool?: boolean;
  hasElevator?: boolean;
  hasAirConditioner?: boolean;
  hasFurniture?: boolean;
  hasSecurity?: boolean;
  hasGym?: boolean;
  hasWifi?: boolean;
}

@Entity('tbl_estate')
export class Estate extends ApprovalBaseEntity {
  // --- FK: User (broker / chủ đăng) ---
  @Column({ name: 'fk_user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'fk_user_id' })
  user: User;

  // --- Location ---
  @Column({ type: 'varchar', length: 500 })
  address: string;

  @Column({ name: 'fk_province_id', type: 'uuid', nullable: true })
  provinceId?: string;

  @ManyToOne(() => Province, (province) => province.estates, { nullable: true })
  @JoinColumn({ name: 'fk_province_id' })
  province?: Province;

  @Column({ name: 'fk_ward_id', type: 'uuid', nullable: true })
  wardId?: string;

  @ManyToOne(() => Ward, (ward) => ward.estates, { nullable: true })
  @JoinColumn({ name: 'fk_ward_id' })
  ward?: Ward;

  // --- LIST fields (hiển thị trên card/list) ---
  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'bigint', nullable: true })
  price?: number;

  @Column({ type: 'enum', enum: PropertyType })
  type: PropertyType;

  @Column({ type: 'enum', enum: PropertyPurpose })
  purpose: PropertyPurpose;

  // --- DETAIL fields (chỉ load khi xem chi tiết) ---
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  area?: number;

  @Column({ type: 'int', nullable: true })
  bedrooms?: number;

  @Column({ type: 'int', nullable: true })
  bathrooms?: number;

  @Column({ type: 'int', nullable: true })
  floors?: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude?: number;

  @Column({ type: 'json', nullable: true })
  features?: PropertyFeatures;

  // --- Thông tin đăng tin ---
  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate?: Date;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate?: Date;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;
}
