import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import { TokenPayloadSchema, type TokenPayload, type UserRead } from '@naru/shared';
import { appConfig } from '../config';
import prisma from '../db';

/**
 * Auth middleware that verifies JWT from Authorization header
 * and sets c.var.user with the authenticated user data.
 *
 * Usage: app.use(auth) or app.get('/route', auth, handler)
 */
export async function auth(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    // Verify and decode the JWT token
    const decoded = jwt.verify(token, appConfig.JWT_SECRET) as unknown;

    // Validate the token payload structure using Zod
    const payload = TokenPayloadSchema.parse(decoded);

    // Fetch the user from database to ensure they still exist and get current data
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        localId: true,
        login: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        lang: true,
        createdAt: true,
        updatedAt: true,
        // Explicitly exclude passwordHash and deletedAt
      },
    });

    if (!user) {
      throw new HTTPException(401, { message: 'User not found' });
    }

    // Transform dates to ISO strings to match UserRead schema
    const userRead: UserRead = {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    // Set user in context variables for use in route handlers
    c.set('user', userRead);
    c.set('tokenPayload', payload);

    await next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new HTTPException(401, { message: 'Invalid token' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new HTTPException(401, { message: 'Token expired' });
    }
    // Re-throw other errors (including Zod validation errors)
    throw error;
  }
}

/**
 * Optional auth middleware that sets user if token is present and valid,
 * but doesn't fail if no token is provided. Useful for public routes
 * that can show different content for authenticated users.
 */
export async function optionalAuth(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    // No token provided, continue without setting user
    await next();
    return;
  }

  try {
    await auth(c, next);
  } catch (error) {
    // If token is invalid, continue without setting user rather than failing
    if (error instanceof HTTPException && error.status === 401) {
      await next();
      return;
    }
    throw error;
  }
}