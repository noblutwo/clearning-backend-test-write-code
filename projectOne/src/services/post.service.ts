import type { CreatePostDTO, UpdatePostDTO } from '@/dtos/post.dto';
import { AppDataSource } from '@/database/connection';
import { Post } from '@/database/entities/post.entity';
import { IsNull } from 'typeorm';

export class PostService {
  private static getPostRepository() {
    return AppDataSource.getRepository(Post);
  }

  static async getAllPosts() {
    try {
      const postRepository = this.getPostRepository();
      return await postRepository.find({
        where: { deletedAt: IsNull(), status: 'published' },
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw error;
    }
  }

  static async getPostById(id: string) {
    try {
      const postRepository = this.getPostRepository();
      const post = await postRepository.findOne({
        where: { id, deletedAt: IsNull() },
      });

      if (post) {
        // Increment view count
        await postRepository.increment({ id }, 'viewCount', 1);
      }

      return post;
    } catch (error) {
      console.error('Error fetching post:', error);
      throw error;
    }
  }

  static async getPostBySlug(slug: string) {
    try {
      const postRepository = this.getPostRepository();
      return await postRepository.findOne({
        where: { slug, deletedAt: IsNull() },
      });
    } catch (error) {
      console.error('Error fetching post by slug:', error);
      throw error;
    }
  }

  static async getPostsByStatus(status: string) {
    try {
      const postRepository = this.getPostRepository();
      return await postRepository.find({
        where: { status, deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      console.error('Error fetching posts by status:', error);
      throw error;
    }
  }

  static async createPost(dto: CreatePostDTO) {
    try {
      const postRepository = this.getPostRepository();

      // Check if slug already exists
      const existing = await postRepository.findOne({
        where: { slug: dto.slug, deletedAt: IsNull() },
      });

      if (existing) {
        throw new Error('Slug already exists');
      }

      const post = postRepository.create({
        title: dto.title,
        slug: dto.slug,
        content: dto.content,
        description: dto.description,
        status: dto.status || 'draft',
        viewCount: 0,
      });

      return await postRepository.save(post);
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  static async updatePost(id: string, dto: UpdatePostDTO) {
    try {
      const postRepository = this.getPostRepository();
      const post = await postRepository.findOne({
        where: { id, deletedAt: IsNull() },
      });

      if (!post) {
        return null;
      }

      // Check if slug is being changed and if new slug exists
      if (dto.slug && dto.slug !== post.slug) {
        const existing = await postRepository.findOne({
          where: { slug: dto.slug, deletedAt: IsNull() },
        });
        if (existing) {
          throw new Error('Slug already exists');
        }
      }

      Object.assign(post, dto);
      return await postRepository.save(post);
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }

  static async publishPost(id: string) {
    try {
      const postRepository = this.getPostRepository();
      const post = await postRepository.findOne({
        where: { id, deletedAt: IsNull() },
      });

      if (!post) {
        return null;
      }

      post.status = 'published';
      return await postRepository.save(post);
    } catch (error) {
      console.error('Error publishing post:', error);
      throw error;
    }
  }

  static async deletePost(id: string) {
    try {
      const postRepository = this.getPostRepository();
      const post = await postRepository.findOne({
        where: { id, deletedAt: IsNull() },
      });

      if (!post) {
        return false;
      }

      post.deletedAt = new Date();
      await postRepository.save(post);
      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }
}
