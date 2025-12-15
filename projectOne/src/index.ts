import 'reflect-metadata';
import { Elysia } from 'elysia';
import { routes } from './routes';
import { config } from './config/env';
import { logger } from './utils/logger';
import { initializeDatabase } from './database/connection';

async function bootstrap() {
  // Initialize database
  await initializeDatabase();

  // Create and start server
  const app = new Elysia()
    .use(routes)
    .get('/', () => ({
      success: true,
      message: 'Welcome to Elysia Backend API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    }))
    .listen(config.port, () => {
      logger.info(`🚀 Server is running on http://localhost:${config.port}`, {
        environment: config.env,
        port: config.port,
        database: 'PostgreSQL + TypeORM',
      });
    });

  return app;
}

bootstrap().catch((error) => {
  logger.error('Failed to bootstrap application', { error });
  process.exit(1);
});
