import type { CreateUserDTO, UpdateUserDTO } from '@/types/api.types';
import { AppDataSource } from '@/database/connection';
import { User } from '@/database/entities/user.entity';
import { IsNull } from 'typeorm';

export class UserService {
  private static getUserRepository() {
    return AppDataSource.getRepository(User);
  }

  static async getAllUsers() {
    try {
      const userRepository = this.getUserRepository();
      return await userRepository.find({
        where: { deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  static async getUserById(id: string) {
    try {
      const userRepository = this.getUserRepository();
      return await userRepository.findOne({
        where: { id, deletedAt: IsNull() },
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  }

  static async createUser(dto: CreateUserDTO) {
    try {
      const userRepository = this.getUserRepository();
      const user = userRepository.create({
        name: dto.name,
        email: dto.email,
        status: 'active',
      });

      return await userRepository.save(user);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async updateUser(id: string, dto: UpdateUserDTO) {
    try {
      const userRepository = this.getUserRepository();
      const user = await userRepository.findOne({
        where: { id, deletedAt: IsNull() },
      });

      if (!user) {
        return null;
      }

      if (dto.name) {
        user.name = dto.name;
      }

      if (dto.email) {
        user.email = dto.email;
      }

      return await userRepository.save(user);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  static async deleteUser(id: string) {
    try {
      const userRepository = this.getUserRepository();
      const user = await userRepository.findOne({
        where: { id, deletedAt: IsNull() },
      });

      if (!user) {
        return false;
      }

      user.deletedAt = new Date();
      await userRepository.save(user);
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}
