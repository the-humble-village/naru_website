import bcrypt from 'bcrypt';
import { HTTPException } from 'hono/http-exception';
import {
  type UserCreate,
  type UserUpdate,
  type UserRead,
  type Role
} from '@naru/shared';
import prisma from '../db';

const BCRYPT_ROUNDS = 12;

/**
 * List all users with optional pagination
 * Only accessible to admin users
 */
export async function listUsers(options: {
  skip?: number;
  limit?: number;
} = {}): Promise<{ users: UserRead[]; total: number }> {
  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 20)); // Max 100 per page

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
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
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.user.count(),
  ]);

  // Transform dates to ISO strings
  const usersRead: UserRead[] = users.map((user: any) => ({
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }));

  return {
    users: usersRead,
    total,
  };
}

/**
 * Get user by ID
 * Only accessible to admin users
 */
export async function getUserById(id: number): Promise<UserRead> {
  const user = await prisma.user.findUnique({
    where: { id },
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
    throw new HTTPException(404, { message: 'User not found' });
  }

  // Transform dates to ISO strings
  const userRead: UserRead = {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };

  return userRead;
}

/**
 * Update user by ID
 * Only accessible to admin users
 */
export async function updateUser(id: number, data: UserUpdate): Promise<UserRead> {
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, login: true },
  });

  if (!existingUser) {
    throw new HTTPException(404, { message: 'User not found' });
  }

  // If updating login, check for uniqueness
  if (data.login && data.login !== existingUser.login) {
    const loginExists = await prisma.user.findUnique({
      where: { login: data.login },
      select: { id: true },
    });

    if (loginExists) {
      throw new HTTPException(400, { message: 'User with this login already exists' });
    }
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      login: data.login,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      lang: data.lang,
      updatedAt: new Date(),
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
    ...updatedUser,
    createdAt: updatedUser.createdAt.toISOString(),
    updatedAt: updatedUser.updatedAt.toISOString(),
  };

  return userRead;
}

/**
 * Update current user's language preference
 * Accessible to any authenticated user for their own profile
 */
export async function updateUserLanguage(userId: number, lang: string): Promise<UserRead> {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      lang,
      updatedAt: new Date(),
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
    ...updatedUser,
    createdAt: updatedUser.createdAt.toISOString(),
    updatedAt: updatedUser.updatedAt.toISOString(),
  };

  return userRead;
}

/**
 * Create a new user
 * Only accessible to admin users
 */
export async function createUser(data: UserCreate): Promise<UserRead> {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { login: data.login },
    select: { id: true },
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
      role: data.role || 'CASEWORKER',
      lang: data.lang || 'en',
      localId: data.localId,
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

  return userRead;
}