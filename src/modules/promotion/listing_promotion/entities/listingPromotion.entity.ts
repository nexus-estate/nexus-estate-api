import { Check, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';

import { BaseEntity } from '../../../../services/abstraction-services';
import { Listing } from '../../../listing/listing/entities/listing.entity';

export enum PromotionEnum {
  BANNER = 'BANNER',
}

@Entity('tbl_listing_promotion')
@Check('chk_listing_promotion_valid_period', `"end_at" > "start_at"`)
export class ListingPromotion extends BaseEntity {
  @Column({
    name: 'fk_listing_id',
    type: 'uuid',
    nullable: false,
  })
  listingId: string;

  @ManyToOne(() => Listing, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'fk_listing_id' })
  listing: Relation<Listing>;

  @Column({
    name: 'promotion_type',
    type: 'enum',
    enum: PromotionEnum,
    nullable: false,
  })
  promotionType: PromotionEnum;

  @Column({
    name: 'start_at',
    type: 'timestamptz',
    nullable: false,
  })
  startAt: Date;

  @Column({
    name: 'end_at',
    type: 'timestamptz',
    nullable: false,
  })
  endAt: Date;
}
