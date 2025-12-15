import 'reflect-metadata';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('posts')
@Index(['slug'], { unique: true })
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  title!: string;

  @Column('varchar', { length: 255, unique: true })
  slug!: string;

  @Column('text')
  content!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('varchar', { length: 50, default: 'draft' })
  status!: string;

  @Column('int', { default: 0 })
  viewCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column('datetime', { nullable: true })
  deletedAt?: Date;
}
