import type { CreateUserDTO, UpdateUserDTO } from '@/types/api.types';
import type { ApiResponse } from '@/types/response.types';
import { UserService } from '@/services/user.service';
import { HTTP_STATUS } from '@/config/constants';
import { isValidEmail } from '@/utils/helpers';

export class UserController {
  static async getAll() {
    try {
      const users = await UserService.getAllUsers();
      const response: ApiResponse = {
        success: true,
        data: users,
        timestamp: new Date().toISOString(),
      };
      return { status: HTTP_STATUS.OK, body: response };
    } catch (error) {
      return {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: 'Failed to fetch users',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    }
  }

  static async getById(id: string) {
    try {
      const user = await UserService.getUserById(id);

      if (!user) {
        return {
          status: HTTP_STATUS.NOT_FOUND,
          body: {
            success: false,
            error: 'User not found',
            timestamp: new Date().toISOString(),
          } as ApiResponse,
        };
      }

      return {
        status: HTTP_STATUS.OK,
        body: {
          success: true,
          data: user,
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    } catch (error) {
      return {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: 'Failed to fetch user',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    }
  }

  static async create(dto: CreateUserDTO) {
    try {
      if (!dto.name || !dto.email) {
        return {
          status: HTTP_STATUS.BAD_REQUEST,
          body: {
            success: false,
            error: 'Name and email are required',
            timestamp: new Date().toISOString(),
          } as ApiResponse,
        };
      }

      if (!isValidEmail(dto.email)) {
        return {
          status: HTTP_STATUS.BAD_REQUEST,
          body: {
            success: false,
            error: 'Invalid email format',
            timestamp: new Date().toISOString(),
          } as ApiResponse,
        };
      }

      const user = await UserService.createUser(dto);
      return {
        status: HTTP_STATUS.CREATED,
        body: {
          success: true,
          data: user,
          message: 'User created successfully',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    } catch (error: any) {
      const errorMessage = error?.message?.includes('duplicate')
        ? 'Email already exists'
        : 'Failed to create user';

      return {
        status: HTTP_STATUS.BAD_REQUEST,
        body: {
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    }
  }

  static async update(id: string, dto: UpdateUserDTO) {
    try {
      if (dto.email && !isValidEmail(dto.email)) {
        return {
          status: HTTP_STATUS.BAD_REQUEST,
          body: {
            success: false,
            error: 'Invalid email format',
            timestamp: new Date().toISOString(),
          } as ApiResponse,
        };
      }

      const user = await UserService.updateUser(id, dto);

      if (!user) {
        return {
          status: HTTP_STATUS.NOT_FOUND,
          body: {
            success: false,
            error: 'User not found',
            timestamp: new Date().toISOString(),
          } as ApiResponse,
        };
      }

      return {
        status: HTTP_STATUS.OK,
        body: {
          success: true,
          data: user,
          message: 'User updated successfully',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    } catch (error) {
      return {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: 'Failed to update user',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    }
  }

  static async delete(id: string) {
    try {
      const deleted = await UserService.deleteUser(id);

      if (!deleted) {
        return {
          status: HTTP_STATUS.NOT_FOUND,
          body: {
            success: false,
            error: 'User not found',
            timestamp: new Date().toISOString(),
          } as ApiResponse,
        };
      }

      return {
        status: HTTP_STATUS.OK,
        body: {
          success: true,
          data: { id },
          message: 'User deleted successfully',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    } catch (error) {
      return {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: 'Failed to delete user',
          timestamp: new Date().toISOString(),
        } as ApiResponse,
      };
    }
  }
}
