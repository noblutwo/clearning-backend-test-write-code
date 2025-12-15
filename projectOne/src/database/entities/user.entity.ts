import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('varchar', { length: 255, unique: true })
  email!: string;

  @Column('varchar', { length: 255, nullable: true })
  phone?: string;

  @Column('text', { nullable: true })
  address?: string;

  @Column('varchar', { length: 50, default: 'active' })
  status!: string;

  @Column('varchar', { length: 50, default: 'user' })
  role!: 'admin' | 'user';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column('datetime', { nullable: true })
  deletedAt?: Date;
}
