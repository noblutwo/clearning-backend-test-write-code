import { IsNull } from 'typeorm';
import { AppDataSource } from '@/database/connection';
import { User } from '@/database/entities/user.entity';
import type { CreateUserDTO, UpdateUserDTO } from '@/dtos/user.dto';
import { BaseRepository } from './base.repository';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(AppDataSource.getRepository(User));
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.findOneByCondition({ email, deletedAt: IsNull() } as any);
  }

  async create(data: CreateUserDTO): Promise<User> {
    return await super.create({
      ...data,
      status: 'active',
    });
  }
}
