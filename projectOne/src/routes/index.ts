import { Elysia } from 'elysia';
import { healthRoutes } from './v1/health.routes';
import { userRoutes } from './v1/users.routes';
import { postRoutes } from './v1/posts.routes';

export const routes = new Elysia()
  .use(healthRoutes)
  .use(userRoutes)
  .use(postRoutes);
