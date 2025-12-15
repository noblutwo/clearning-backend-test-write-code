import { Elysia, t } from 'elysia';
import { UserController } from '@/controllers/health.controller';
import { requireAuth, requireRole, getAuthUser } from '@/middleware/auth.middleware';

export const userRoutes = new Elysia({ prefix: '/api/v1/users' })
  // PUBLIC ROUTES
  // Get all users - requires authentication
  .get('/', async (context: any) => {
    requireAuth(context);
    return await UserController.getAll();
  })

  // Get user by ID - requires authentication
  .get('/:id', async (context: any) => {
    requireAuth(context);
    const { id } = context.params;
    return await UserController.getById(id);
  }, {
    params: t.Object({
      id: t.String(),
    }),
  })

  // Create new user - PUBLIC (anyone can register)
  .post(
    '/',
    ({ body }) => UserController.create(body),
    { 
      detail: {
        description: 'Create a new user (Public endpoint)',
        tags: ['Users'],
      },
      body: t.Object({
        name: t.String(),
        email: t.String(),
        phone: t.Optional(t.String()),
        address: t.Optional(t.String()),
        role: t.Optional(t.Union([t.Literal('admin'), t.Literal('user')])),
      }),
    }
  )

  // ADMIN ONLY ROUTES
  // Update user - requires ADMIN role
  .put(
    '/:id',
    async (context: any) => {
      requireAuth(context);
      requireRole('admin')(context);
      
      const authUser = getAuthUser(context);
      const { id } = context.params;
      const { body } = context;
      
      // Log admin action
      console.log(`[ADMIN ACTION] User ${authUser.email} is updating user ${id}`);
      
      return await UserController.update(id, body);
    },
    {
      detail: {
        description: 'Update user (ADMIN ONLY)',
        tags: ['Users - Admin'],
      },
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        email: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        address: t.Optional(t.String()),
        status: t.Optional(t.String()),
        role: t.Optional(t.Union([t.Literal('admin'), t.Literal('user')])),
      }),
    }
  )

  // Delete user - requires ADMIN role
  .delete(
    '/:id',
    async (context: any) => {
      requireAuth(context);
      requireRole('admin')(context);
      
      const authUser = getAuthUser(context);
      const { id } = context.params;
      
      // Log admin action
      console.log(`[ADMIN ACTION] User ${authUser.email} is deleting user ${id}`);
      
      return await UserController.delete(id);
    },
    {
      detail: {
        description: 'Delete user (ADMIN ONLY)',
        tags: ['Users - Admin'],
      },
      params: t.Object({
        id: t.String(),
      }),
    }
  );
