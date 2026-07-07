import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

export enum UserRole {
    ADMIN = 'ADMIN',
    BROKER = 'BROKER',
    BUYER = 'BUYER',
}

@Entity('tbl_user')  // ← Thêm prefix tbl_
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column()
    fullName: string;

    @Column({ nullable: true })
    phoneNumber: string;

    @Column({ nullable: true })
    avatar: string;

    @Column({ nullable: true })
    bio: string;

    @Column({ type: 'enum', enum: UserRole, default: UserRole.BUYER })
    role: UserRole;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: false })
    isEmailVerified: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ nullable: true })
    lastLogin: Date;

    // ← Thêm version lock cho permistic lock
    @Column({ default: 0 })
    version: number;
}