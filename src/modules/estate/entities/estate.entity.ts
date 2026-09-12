import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from '../../../services/abstraction-services';
import { Province, Ward } from '../../location/entities/location.entity';
import { BuyerAccount } from '../../buyer/account/models/buyer-account.entity';
import { EstatePurpose, EstateType } from '../type/estate.type';

@Entity('tbl_estate')
export class Estate extends BaseEntity {
  @Column({ name: 'fk_buyer_id', type: 'uuid', nullable: false })
  buyerId: string;

  @ManyToOne(() => BuyerAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fk_buyer_id' })
  buyer: Relation<BuyerAccount>;

  @Column({ type: 'varchar', length: 500, nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: EstateType, nullable: false })
  type: EstateType;

  @Column({ type: 'enum', enum: EstatePurpose, nullable: false })
  purpose: EstatePurpose;

  @Column({ type: 'bigint', nullable: false })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  area: number | null;

  @Column({ type: 'int', nullable: true })
  bedrooms: number | null;

  @Column({ type: 'int', nullable: true })
  bathrooms: number | null;

  @Column({ type: 'int', nullable: true })
  floors: number | null;

  @Column({
    name: 'address_line',
    type: 'varchar',
    length: 500,
    nullable: false,
  })
  addressLine: string;

  @Column({ name: 'fk_province_id', type: 'uuid', nullable: false })
  provinceId: string;

  @ManyToOne(() => Province, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fk_province_id' })
  province: Relation<Province>;

  @Column({ name: 'fk_ward_id', type: 'uuid', nullable: false })
  wardId: string;

  @ManyToOne(() => Ward, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fk_ward_id' })
  ward: Relation<Ward>;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;
}
