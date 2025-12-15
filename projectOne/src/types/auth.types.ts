/**
 * Auth Types - Authentication and Authorization
 */

export type UserRole = 'admin' | 'user';

/**
 * User context attached to request after authentication
 * Used in middleware to pass user info to controllers
 */
export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Auth middleware options
 */
export interface AuthMiddlewareOptions {
  /**
   * If true, only admin role can access
   * If false or undefined, any authenticated user can access
   */
  requireAdmin?: boolean;
  
  /**
   * Custom error message for unauthorized access
   */
  errorMessage?: string;
}
