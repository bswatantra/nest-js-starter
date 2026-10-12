/**
 * Application Routes Definition
 * Central source of truth for all endpoint routing paths.
 */
export const ROUTES = {
  HEALTH: {
    ROOT: 'health',
  },
  USERS: {
    ROOT: 'users',
    BY_ID: ':id',
  },
  POSTS: {
    ROOT: 'posts',
    BY_ID: ':id',
    BY_USER: 'user/:userId',
  },
} as const;

export type AppRoutes = typeof ROUTES;

