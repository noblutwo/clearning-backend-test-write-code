import { Elysia } from 'elysia';
import type { ApiResponse } from '@/types/response.types';

export const healthRoutes = new Elysia({ prefix: '/api/v1' }).get('/health', () => {
  const response: ApiResponse = {
    success: true,
    message: 'Server is healthy',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: Bun.env.NODE_ENV || 'development',
    },
    timestamp: new Date().toISOString(),
  };

  return response;
});
