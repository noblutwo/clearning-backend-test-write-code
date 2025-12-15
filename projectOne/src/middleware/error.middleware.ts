import type { Context } from 'elysia';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/config/constants';
import type { ApiResponse } from '@/types/response.types';
import { logger } from '@/utils/logger';

// Error handling middleware
export const errorHandlerMiddleware = (error: unknown) => {
  const timestamp = new Date().toISOString();

  if (error instanceof Error) {
    logger.error('Application Error', {
      message: error.message,
      stack: error.stack,
      timestamp,
    });

    const response: ApiResponse = {
      success: false,
      error: error.message || ERROR_MESSAGES.INTERNAL_ERROR,
      timestamp,
    };

    return {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      body: response,
    };
  }

  logger.error('Unknown Error', { error, timestamp });

  return {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    body: {
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      timestamp,
    } as ApiResponse,
  };
};
