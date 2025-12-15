// User DTOs (Data Transfer Objects)
export interface CreateUserDTO {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role?: 'admin' | 'user'; // Optional, defaults to 'user'
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  role?: 'admin' | 'user'; // Only admin can update
}

export interface UserResponseDTO {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  status: string;
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}
