import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { TokenPayloadSchema, type TokenPayload, type UserRead } from '@naru/shared';
import { appConfig } from '../config.js';
import { prisma } from '../db.js';

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

  // Scoped tightly around token verification. `next()` must stay outside it: a
  // handler further down the chain can legitimately throw ZodError (request body
  // validation), and catching that here would turn a 400 into a 401.
  let payload: TokenPayload;
  try {
    // algorithms is pinned so a token can never be presented under a different alg.
    const decoded = jwt.verify(token, appConfig.JWT_SECRET, { algorithms: ['HS256'] });
    payload = TokenPayloadSchema.parse(decoded);
  } catch (error) {
    // TokenExpiredError extends JsonWebTokenError, so it has to be tested first —
    // reversed, the expiry branch is unreachable and expired tokens report
    // "Invalid token".
    if (error instanceof jwt.TokenExpiredError) {
      throw new HTTPException(401, { message: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      // Rejected tokens are routine, not exceptional — warn, and no stack trace.
      console.warn(`Auth rejected: ${error.message}`);
      throw new HTTPException(401, { message: 'Invalid token' });
    }
    if (error instanceof ZodError) {
      // Validly signed but malformed payload. Previously fell through to a 500.
      console.warn('Auth rejected: malformed token payload');
      throw new HTTPException(401, { message: 'Invalid token' });
    }
    throw error;
  }

  // Fetch the user to confirm they still exist and to get current data. The
  // soft-delete extension injects `deletedAt: null`, so a deactivated user's
  // token stops working here.
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
      tokenVersion: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly exclude passwordHash and deletedAt. GET /users/me returns this
      // object verbatim, so anything added here ships to the client — which is why
      // tokenVersion is destructured back out below.
    },
  });

  if (!user) {
    throw new HTTPException(401, { message: 'User not found' });
  }

  // Revocation check. Tokens minted before this claim existed carry no
  // tokenVersion; absent means 0, matching the column default.
  if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
    console.warn(`Auth rejected: stale token version for user ${user.id}`);
    throw new HTTPException(401, { message: 'Session expired. Please sign in again.' });
  }

  const { tokenVersion, ...userWithoutTokenVersion } = user;

  // Transform dates to ISO strings to match UserRead schema
  const userRead: UserRead = {
    ...userWithoutTokenVersion,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };

  // Set user in context variables for use in route handlers
  c.set('user', userRead);
  // The `role` claim on the token is informational only. Every authorization check
  // reads c.var.user.role — the freshly fetched row above — so a role change takes
  // effect on the user's next request. Do not "optimize" requireRole to read the
  // token instead; that would let a demoted user keep their old role until expiry.
  c.set('tokenPayload', payload);

  await next();
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
    // Hand `auth` a no-op rather than `next`, so the rest of the chain runs exactly
    // once below. Passing `next` here means a 401 raised by a downstream handler is
    // caught as "bad token" and the chain is run a second time.
    await auth(c, async () => {});
  } catch (error) {
    // An invalid token is not fatal here — fall through unauthenticated.
    if (!(error instanceof HTTPException && error.status === 401)) {
      throw error;
    }
  }

  await next();
}