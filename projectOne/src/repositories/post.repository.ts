import { IsNull } from 'typeorm';
import { AppDataSource } from '@/database/connection';
import { Post } from '@/database/entities/post.entity';
import type { CreatePostDTO, UpdatePostDTO } from '@/dtos/post.dto';
import { BaseRepository } from './base.repository';
export class PostRepository extends BaseRepository<Post> {
  constructor() {
    super(AppDataSource.getRepository(Post));
  }

  async findBySlug(slug: string): Promise<Post | null> {
    return await this.findOneByCondition({ slug, deletedAt: IsNull() } as any);
  }
  async findByStatus(status: string): Promise<Post[]> {
    return await this.findByCondition({ status, deletedAt: IsNull() } as any);
  }
  async incrementViewCount(id: string): Promise<Post | null> {
    await this.repository.increment({ id }, 'viewCount', 1);
    return await this.findById(id);
  }

  async create(data: CreatePostDTO): Promise<Post> {
    return await super.create({
      ...data,
      status: data.status || 'draft',
      viewCount: 0,
    });
  }
}
