import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { HTTPException } from 'hono/http-exception';
import {
  type Register,
  type Login,
  type AuthResponse,
  type UserRead,
  type TokenPayload
} from '@naru/shared';
import { prisma } from '../db';
import { appConfig } from '../config';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';

/**
 * Register a new user account
 */
export async function register(data: Register): Promise<AuthResponse> {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { login: data.login },
  });

  if (existingUser) {
    throw new HTTPException(400, { message: 'User with this login already exists' });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: {
      login: data.login,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash,
      role: 'CASEWORKER', // Default role for registration
      lang: data.lang || 'en',
    },
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

  // Transform dates to ISO strings
  const userRead: UserRead = {
    ...user,
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
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, appConfig.JWT_REFRESH_SECRET) as TokenPayload;

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
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      if (error instanceof jwt.JsonWebTokenError) {
        console.error(`Refresh JWT Error: ${error.message}`);
      }
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
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(payload, appConfig.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  return {
    accessToken,
    refreshToken,
  };
}