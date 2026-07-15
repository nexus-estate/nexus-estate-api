import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../services/abstraction-services';
import { User } from './user.entity';

@Entity('tbl_data_pool')
@Unique(['userId', 'key'])
export class DataPool extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  key: string;

  @Column({ type: 'json', nullable: true })
  value: Record<string, unknown>;

  @ManyToOne(() => User, (user) => user.dataPools)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
