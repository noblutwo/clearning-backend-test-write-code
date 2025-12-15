import { Elysia, t } from 'elysia';
import { PostController } from '@/controllers/post.controller';

export const postRoutes = new Elysia({ prefix: '/api/v1/posts' })
  // Get all published posts
  .get('/', () => PostController.getAll())

  // Get post by ID
  .get('/:id', ({ params }: { params: { id: string } }) => PostController.getById(params.id), {
    params: t.Object({
      id: t.String(),
    }),
  })

  // Get post by slug
  .get('/slug/:slug', ({ params }: { params: { slug: string } }) =>
    PostController.getBySlug(params.slug),
    {
      params: t.Object({
        slug: t.String(),
      }),
    }
  )

  // Create post
  .post(
    '/',
    ({ body }) => PostController.create(body),
    {
      body: t.Object({
        title: t.String(),
        slug: t.String(),
        content: t.String(),
        description: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
    }
  )

  // Update post
  .put(
    '/:id',
    ({ params, body }) => PostController.update(params.id, body),
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        title: t.Optional(t.String()),
        slug: t.Optional(t.String()),
        content: t.Optional(t.String()),
        description: t.Optional(t.String()),
        status: t.Optional(t.String()),
        viewCount: t.Optional(t.Number()),
      }),
    }
  )

  // Publish post
  .patch('/:id/publish', ({ params }: { params: { id: string } }) =>
    PostController.publish(params.id),
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // Delete post
  .delete('/:id', ({ params }: { params: { id: string } }) => PostController.delete(params.id), {
    params: t.Object({
      id: t.String(),
    }),
  });
