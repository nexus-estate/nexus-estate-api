import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Estate } from '../../../estate/property/entities/estate.entity';

export const PROVINCE_TYPES = {
  PROVINCE: 'province',
  MUNICIPALITY: 'municipality',
} as const;

export const WARD_TYPES = {
  WARD: 'ward',
  COMMUNE: 'commune',
  SPECIAL_ZONE: 'special_zone',
} as const;

export type ProvinceType = (typeof PROVINCE_TYPES)[keyof typeof PROVINCE_TYPES];
export type WardType = (typeof WARD_TYPES)[keyof typeof WARD_TYPES];

@Entity('tbl_province')
export class Province {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 2, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 20 })
  type: ProvinceType;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Ward, (ward) => ward.province)
  wards: Ward[];

  @OneToMany(() => Estate, (estate) => estate.province)
  estates: Estate[];
}

@Entity('tbl_ward')
@Index('idx_ward_province', ['provinceId'])
export class Ward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 5, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  type: WardType;

  @Column({ name: 'fk_province_id', type: 'uuid' })
  provinceId: string;

  @ManyToOne(() => Province, (province) => province.wards, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'fk_province_id' })
  province: Province;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Estate, (estate) => estate.ward)
  estates: Estate[];
}
