import { Check, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';

import { BaseEntity } from '../../../../services/abstraction-services';
import { Promotion } from '../../promotion/entities/promotion.entity';
import { Listing } from '../../../listing/listing/entities/listing.entity';

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
    name: 'fk_promotion_id',
    type: 'uuid',
    nullable: false,
  })
  promotionId: string;

  @ManyToOne(() => Promotion, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'fk_promotion_id' })
  promotion: Relation<Promotion>;

  @Column({
    name: 'price_snapshot',
    type: 'numeric',
    nullable: false,
  })
  priceSnapshot: number;

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
