import type { User } from '@/types/api.types';

// User data model
export interface UserModel extends User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export const createUserModel = (data: Partial<UserModel>): UserModel => {
  return {
    id: data.id || '',
    name: data.name || '',
    email: data.email || '',
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
  };
};
