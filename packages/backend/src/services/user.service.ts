import bcrypt from 'bcrypt';
import { HTTPException } from 'hono/http-exception';
import {
  type UserCreate,
  type UserUpdate,
  type UserRead,
  type Role
} from '@naru/shared';
import prisma from '../db.js';

const BCRYPT_ROUNDS = 12;

/**
 * Columns returned to clients. passwordHash and deletedAt are deliberately absent —
 * neither may ever appear in an API response.
 */
const USER_SELECT = {
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
} as const;

/** Shape of a row selected with USER_SELECT (the prisma client is untyped here). */
type UserRecord = {
  id: number;
  localId: string | null;
  login: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  lang: string;
  createdAt: Date;
  updatedAt: Date;
};

function toUserRead(user: UserRecord): UserRead {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Look up a login across ALL rows, including soft-deleted ones.
 *
 * `login` is unique at the database level regardless of deletedAt, so the
 * soft-delete extension (which hides deleted rows from reads) would otherwise let
 * us walk into a P2002 constraint violation and return a 500 instead of a clear 400.
 */
async function findLoginOwner(
  login: string
): Promise<{ id: number; deletedAt: Date | null } | null> {
  return prisma.user.findFirst({
    where: { login },
    select: { id: true, deletedAt: true },
    includeDeleted: true,
  });
}

/** Number of admins that are still active (not soft-deleted). */
async function countActiveAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } });
}

/**
 * List all users with optional pagination.
 * Soft-deleted users are excluded.
 * Only accessible to admin users.
 */
export async function listUsers(options: {
  skip?: number;
  limit?: number;
} = {}): Promise<{ users: UserRead[]; total: number }> {
  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 20)); // Max 100 per page

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      skip,
      take: limit,
      select: USER_SELECT,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.user.count({ where: { deletedAt: null } }),
  ]);

  return {
    users: (users as UserRecord[]).map(toUserRead),
    total,
  };
}

/**
 * Get user by ID
 * Only accessible to admin users
 */
export async function getUserById(id: number): Promise<UserRead> {
  const user: UserRecord | null = await prisma.user.findUnique({
    where: { id, deletedAt: null },
    select: USER_SELECT,
  });

  if (!user) {
    throw new HTTPException(404, { message: 'User not found' });
  }

  return toUserRead(user);
}

/**
 * Update user by ID (admin only).
 *
 * `actingUserId` is the admin performing the update; it drives the
 * self-protection guards:
 *  - an admin may not strip their own ADMIN role
 *  - the last remaining active admin may not be demoted
 *
 * Passing `password` resets the target user's password.
 */
export async function updateUser(
  id: number,
  data: UserUpdate,
  actingUserId: number
): Promise<UserRead> {
  // Check if user exists (soft-deleted users must not be resurrected)
  const existingUser: { id: number; login: string; role: Role } | null =
    await prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, login: true, role: true },
    });

  if (!existingUser) {
    throw new HTTPException(404, { message: 'User not found' });
  }

  // Role-change guards: only demotions away from ADMIN are dangerous.
  if (data.role && data.role !== existingUser.role && existingUser.role === 'ADMIN') {
    if (id === actingUserId) {
      throw new HTTPException(400, {
        message: 'You cannot change your own role. Ask another admin to do it.',
      });
    }

    const adminCount = await countActiveAdmins();
    if (adminCount <= 1) {
      throw new HTTPException(400, {
        message: 'Cannot demote the last remaining admin. Promote another user to admin first.',
      });
    }
  }

  // If updating login, check for uniqueness (including soft-deleted rows)
  if (data.login && data.login !== existingUser.login) {
    const loginOwner = await findLoginOwner(data.login);

    if (loginOwner && loginOwner.id !== id) {
      throw new HTTPException(400, {
        message: loginOwner.deletedAt
          ? 'A deleted user already uses this login'
          : 'User with this login already exists',
      });
    }
  }

  const passwordHash = data.password
    ? await bcrypt.hash(data.password, BCRYPT_ROUNDS)
    : undefined;

  // Update user
  const updatedUser: UserRecord = await prisma.user.update({
    where: { id, deletedAt: null },
    data: {
      login: data.login,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      lang: data.lang,
      passwordHash,
      updatedAt: new Date(),
    },
    select: USER_SELECT,
  });

  return toUserRead(updatedUser);
}

/**
 * Reset a user's password (admin only).
 * Dedicated path so the admin UI can reset a password without touching any
 * other field. The plain password is hashed here and never returned.
 */
export async function resetUserPassword(id: number, password: string): Promise<UserRead> {
  const existingUser: { id: number } | null = await prisma.user.findUnique({
    where: { id, deletedAt: null },
    select: { id: true },
  });

  if (!existingUser) {
    throw new HTTPException(404, { message: 'User not found' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const updatedUser: UserRecord = await prisma.user.update({
    where: { id, deletedAt: null },
    data: {
      passwordHash,
      updatedAt: new Date(),
    },
    select: USER_SELECT,
  });

  return toUserRead(updatedUser);
}

/**
 * Soft-delete a user by ID (admin only).
 *
 * Guards:
 *  - an admin cannot delete their own account (400)
 *  - the last remaining active admin cannot be deleted (400)
 *  - missing or already-deleted users are 404
 *
 * The row is never removed; `deletedAt` is stamped, and the soft-delete extension
 * then hides the user from every read — including the login lookup in
 * auth.service.login, so a deleted user can no longer authenticate.
 */
export async function deleteUser(id: number, actingUserId: number): Promise<void> {
  if (id === actingUserId) {
    throw new HTTPException(400, {
      message: 'You cannot delete your own account. Ask another admin to do it.',
    });
  }

  const existingUser: { id: number; role: Role } | null = await prisma.user.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, role: true },
  });

  if (!existingUser) {
    throw new HTTPException(404, { message: 'User not found' });
  }

  if (existingUser.role === 'ADMIN') {
    const adminCount = await countActiveAdmins();
    if (adminCount <= 1) {
      throw new HTTPException(400, {
        message: 'Cannot delete the last remaining admin. Promote another user to admin first.',
      });
    }
  }

  await prisma.user.update({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

/**
 * Update current user's language preference
 * Accessible to any authenticated user for their own profile
 */
export async function updateUserLanguage(userId: number, lang: string): Promise<UserRead> {
  const updatedUser: UserRecord = await prisma.user.update({
    where: { id: userId, deletedAt: null },
    data: {
      lang,
      updatedAt: new Date(),
    },
    select: USER_SELECT,
  });

  return toUserRead(updatedUser);
}

/**
 * Create a new user
 * Only accessible to admin users
 */
export async function createUser(data: UserCreate): Promise<UserRead> {
  // Check if the login is taken by any row, including soft-deleted ones —
  // the unique constraint does not care about deletedAt.
  const loginOwner = await findLoginOwner(data.login);

  if (loginOwner) {
    throw new HTTPException(400, {
      message: loginOwner.deletedAt
        ? 'A deleted user already uses this login'
        : 'User with this login already exists',
    });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  // Create user
  const user: UserRecord = await prisma.user.create({
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
    select: USER_SELECT,
  });

  return toUserRead(user);
}
