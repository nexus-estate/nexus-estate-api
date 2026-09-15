import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';
import { Estate } from '../../../estate/property/entities/estate.entity';

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

@Entity('tbl_media')
export class Media extends BaseEntity {
  @Column({ name: 'fk_estate_id', type: 'uuid' })
  estateId: string;

  @ManyToOne(() => Estate)
  @JoinColumn({ name: 'fk_estate_id' })
  estate: Estate;

  @Column({ name: 'media_url', type: 'varchar', length: 1000 })
  mediaUrl: string;

  @Column({ type: 'enum', enum: MediaType })
  type: MediaType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  caption?: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
