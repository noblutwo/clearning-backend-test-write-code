import type { CreatePostDTO, UpdatePostDTO } from '@/dtos/post.dto';
import type { ApiResponse } from '@/types/response.types';
import { PostService } from '@/services/post.service';
import { HTTP_STATUS } from '@/config/constants';

export class PostController {
  static async getAll() {
    try {
      const posts = await PostService.getAllPosts();
      return {
        status: HTTP_STATUS.OK,
        body: {
          success: true,
          data: posts,
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    } catch (error) {
      return {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: 'Failed to fetch posts',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    }
  }

  static async getById(id: string) {
    try {
      const post = await PostService.getPostById(id);

      if (!post) {
        return {
          status: HTTP_STATUS.NOT_FOUND,
          body: {
            success: false,
            error: 'Post not found',
            timestamp: new Date().toISOString(),
          } as ApiResponse,
        };
      }

      return {
        status: HTTP_STATUS.OK,
        body: {
          success: true,
          data: post,
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    } catch (error) {
      return {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: 'Failed to fetch post',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    }
  }

  static async getBySlug(slug: string) {
    try {
      const post = await PostService.getPostBySlug(slug);

      if (!post) {
        return {
          status: HTTP_STATUS.NOT_FOUND,
          body: {
            success: false,
            error: 'Post not found',
            timestamp: new Date().toISOString(),
          } as ApiResponse,
        };
      }

      return {
        status: HTTP_STATUS.OK,
        body: {
          success: true,
          data: post,
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    } catch (error) {
      return {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: 'Failed to fetch post',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    }
  }

  static async create(dto: CreatePostDTO) {
    try {
      if (!dto.title || !dto.slug || !dto.content) {
        return {
          status: HTTP_STATUS.BAD_REQUEST,
          body: {
            success: false,
            error: 'Title, slug, and content are required',
            timestamp: new Date().toISOString(),
          } as ApiResponse,
        };
      }

      const post = await PostService.createPost(dto);
      return {
        status: HTTP_STATUS.CREATED,
        body: {
          success: true,
          data: post,
          message: 'Post created successfully',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    } catch (error: any) {
      return {
        status: HTTP_STATUS.BAD_REQUEST,
        body: {
          success: false,
          error: error?.message || 'Failed to create post',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    }
  }

  static async update(id: string, dto: UpdatePostDTO) {
    try {
      const post = await PostService.updatePost(id, dto);

      if (!post) {
        return {
          status: HTTP_STATUS.NOT_FOUND,
          body: {
            success: false,
            error: 'Post not found',
            timestamp: new Date().toISOString(),
          } as ApiResponse,
        };
      }

      return {
        status: HTTP_STATUS.OK,
        body: {
          success: true,
          data: post,
          message: 'Post updated successfully',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    } catch (error: any) {
      return {
        status: HTTP_STATUS.BAD_REQUEST,
        body: {
          success: false,
          error: error?.message || 'Failed to update post',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    }
  }

  static async publish(id: string) {
    try {
      const post = await PostService.publishPost(id);

      if (!post) {
        return {
          status: HTTP_STATUS.NOT_FOUND,
          body: {
            success: false,
            error: 'Post not found',
            timestamp: new Date().toISOString(),
          } as ApiResponse,
        };
      }

      return {
        status: HTTP_STATUS.OK,
        body: {
          success: true,
          data: post,
          message: 'Post published successfully',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    } catch (error) {
      return {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: 'Failed to publish post',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    }
  }

  static async delete(id: string) {
    try {
      const deleted = await PostService.deletePost(id);

      if (!deleted) {
        return {
          status: HTTP_STATUS.NOT_FOUND,
          body: {
            success: false,
            error: 'Post not found',
            timestamp: new Date().toISOString(),
          } as ApiResponse,
        };
      }

      return {
        status: HTTP_STATUS.OK,
        body: {
          success: true,
          data: { id },
          message: 'Post deleted successfully',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    } catch (error) {
      return {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: 'Failed to delete post',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    }
  }
}
