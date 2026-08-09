import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import {
  TokenPayloadSchema,
  type Login,
  type AuthResponse,
  type UserRead,
  type TokenPayload
} from '@naru/shared';
import { prisma } from '../db.js';
import { appConfig } from '../config.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';

// Account creation lives in user.service.ts createUser(), behind admin auth.
// There is no self-service registration: it could only ever mint CASEWORKERs,
// and being unauthenticated it handed any caller read access to patient data.

/**
 * Login with existing credentials
 */
export async function login(data: Login): Promise<AuthResponse> {
  // Find user by login
  const user = await prisma.user.findUnique({
    where: { login: data.login },
    select: {
      id: true,
      localId: true,
      login: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      lang: true,
      passwordHash: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly exclude deletedAt
    },
  });

  if (!user) {
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
  if (!isValidPassword) {
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  // Remove passwordHash from response
  const { passwordHash, ...userWithoutPassword } = user;

  // Transform dates to ISO strings
  const userRead: UserRead = {
    ...userWithoutPassword,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };

  // Generate tokens
  const tokens = generateTokens(userRead);

  return {
    user: userRead,
    ...tokens,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  try {
    // Verify refresh token. Parsed rather than cast so a validly signed but
    // malformed payload is a 401 here, not an unhandled 500 downstream.
    const decoded = TokenPayloadSchema.parse(
      jwt.verify(refreshToken, appConfig.JWT_REFRESH_SECRET, { algorithms: ['HS256'] })
    );

    // Fetch current user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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

    // Transform dates to ISO strings
    const userRead: UserRead = {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    // Generate new tokens
    const tokens = generateTokens(userRead);

    return {
      user: userRead,
      ...tokens,
    };
  } catch (error) {
    // 401s raised inside the try (e.g. "User not found") must pass through intact.
    if (error instanceof HTTPException) {
      throw error;
    }
    // TokenExpiredError extends JsonWebTokenError, so one check covers both.
    if (error instanceof jwt.JsonWebTokenError) {
      console.warn(`Refresh rejected: ${error.message}`);
      throw new HTTPException(401, { message: 'Invalid refresh token' });
    }
    if (error instanceof ZodError) {
      console.warn('Refresh rejected: malformed token payload');
      throw new HTTPException(401, { message: 'Invalid refresh token' });
    }
    throw error;
  }
}

/**
 * Generate access and refresh tokens for a user
 */
function generateTokens(user: UserRead): { accessToken: string; refreshToken: string } {
  const payload: TokenPayload = {
    userId: user.id,
    role: user.role,
    lang: user.lang,
  };

  const accessToken = jwt.sign(payload, appConfig.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(payload, appConfig.JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  return {
    accessToken,
    refreshToken,
  };
}