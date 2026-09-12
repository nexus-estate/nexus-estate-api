import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../../services/abstraction-services';
import { Estate } from '../../../estate/property/entities/estate.entity';

@Entity('tbl_lead')
export class Lead extends BaseEntity {
  @Column({ name: 'fk_estate_id', type: 'uuid' })
  estateId: string;

  @ManyToOne(() => Estate)
  @JoinColumn({ name: 'fk_estate_id' })
  estate: Estate;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  message?: string;
}
