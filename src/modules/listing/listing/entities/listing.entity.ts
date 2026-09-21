import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';
import { Estate } from '../../../estate/property/entities/estate.entity';
import { ProviderAccount } from '../../../provider/account/entities/provider-account.entity';

export enum ListingStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

@Entity('tbl_listing')
@Index('uq_listing_estate_active', ['estateId'], { unique: true })
@Index('idx_listing_status_published_at', ['status', 'publishedAt'])
export class Listing extends BaseEntity {
  @Column({ name: 'fk_estate_id', type: 'uuid' })
  estateId: string;

  @ManyToOne(() => Estate, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fk_estate_id' })
  estate: Relation<Estate>;

  @Column({ name: 'fk_provider_id', type: 'uuid' })
  providerId: string;

  @ManyToOne(() => ProviderAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fk_provider_id' })
  provider: Relation<ProviderAccount>;

  @Column({ type: 'enum', enum: ListingStatus, default: ListingStatus.DRAFT })
  status: ListingStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
