import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';

export enum PromotionType {
  BANNER = 'BANNER',
  TOP_SEARCH = 'TOP_SEARCH',
  FEATURED = 'FEATURED',
}

export enum PromotionValueType {
  MONEY = 'MONEY',
  TEXT = 'TEXT',
}

@Entity('tbl_promotion')
export class Promotion extends BaseEntity {
  @Column({
    type: 'enum',
    enum: PromotionType,
  })
  type: PromotionType;

  @Column({
    type: 'varchar',
  })
  name: string;

  @Column({
    name: 'value_type',
    type: 'enum',
    enum: PromotionValueType,
  })
  valueType: PromotionValueType;

  @Column({
    name: 'money_value',
    type: 'numeric',
    nullable: true,
  })
  moneyValue: number;

  @Column({
    name: 'text_value',
    type: 'text',
    nullable: true,
  })
  textValue?: string;

  @Column({
    name: 'image_urls',
    type: 'text',
    array: true,
    nullable: true,
  })
  imageUrls?: string[];

  @Column({
    name: 'is_active',
    default: true,
  })
  isActive: boolean;
}
