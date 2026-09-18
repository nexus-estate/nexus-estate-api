import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';
import { Listing } from '../../../listing/listing/entities';

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  CLOSED = 'CLOSED',
}

@Entity('tbl_lead')
export class Lead extends BaseEntity {
  @Column({ name: 'fk_listing_id', type: 'uuid' })
  listingId: string;

  @ManyToOne(() => Listing, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fk_listing_id' })
  listing: Listing;

  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.NEW })
  status: LeadStatus;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 40 })
  phone: string;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;
}
