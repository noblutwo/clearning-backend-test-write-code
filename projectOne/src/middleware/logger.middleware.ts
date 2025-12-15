import { logger } from '@/utils/logger';

// Request logging middleware function
export function setupRequestLogger(app: any) {
  // Log all requests
  app.use(async (ctx: any, next: any) => {
    const startTime = performance.now();
    const method = ctx.request?.method || 'UNKNOWN';
    const url = ctx.request?.url || 'UNKNOWN';

    try {
      await next();
      const duration = (performance.now() - startTime).toFixed(2);

      logger.info(`[${method}] ${url}`, {
        status: ctx.status || 200,
        duration: `${duration}ms`,
      });
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      logger.error(`[${method}] ${url}`, {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  });
}

