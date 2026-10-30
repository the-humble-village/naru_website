import { z } from 'zod';

// Role enum for validation
export const RoleSchema = z.enum(['ADMIN', 'SUPERVISOR', 'CASEWORKER']);

// User creation schema (admin create only — there is no self-service signup)
export const UserCreateSchema = z.object({
  login: z.string().min(1).max(255),
  email: z.string().email().optional().nullable(),
  firstName: z.string().max(255).optional().nullable(),
  lastName: z.string().max(255).optional().nullable(),
  password: z.string().min(12), // Plain password for creation
  role: RoleSchema.default('CASEWORKER'),
  lang: z.string().max(5).default('en'),
  localId: z.string().uuid().optional(), // For offline-created records
});

// User update schema (partial fields for updates)
// `password` is the admin password-reset path: when present the plain password is
// hashed server-side and replaces passwordHash. It is never echoed back.
export const UserUpdateSchema = z.object({
  login: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().nullable(),
  firstName: z.string().max(255).optional().nullable(),
  lastName: z.string().max(255).optional().nullable(),
  role: RoleSchema.optional(),
  lang: z.string().max(5).optional(),
  password: z.string().min(12).optional(),
}).partial();

// Dedicated password reset payload (admin resetting another user's password)
export const UserPasswordResetSchema = z.object({
  password: z.string().min(12),
});

// User read schema (what's returned from API - never includes passwordHash)
export const UserReadSchema = z.object({
  id: z.number().int().positive(),
  localId: z.string().nullable(),
  login: z.string(),
  email: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: RoleSchema,
  lang: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Note: deletedAt and passwordHash are never exposed
});

// Login request schema.
//
// `password` stays min(1) on purpose. The 12-character minimum above applies to
// setting a password, not to presenting one: raising it here would reject every
// account created under the old rule with a validation error rather than
// "Invalid credentials" — locking those users out, and telling an attacker which
// accounts have a short password.
export const LoginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

// JWT token payload schema
export const TokenPayloadSchema = z.object({
  userId: z.number().int().positive(),
  role: RoleSchema,
  lang: z.string(),
  // Revocation counter, compared against users.token_version on every request.
  // Optional so tokens minted before this claim existed still parse; absent is
  // treated as 0, which is the column default.
  tokenVersion: z.number().int().nonnegative().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

// Auth API response schema (for login/refresh)
export const AuthResponseSchema = z.object({
  user: UserReadSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});

// Inferred types for TypeScript
export type Role = z.infer<typeof RoleSchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type UserPasswordReset = z.infer<typeof UserPasswordResetSchema>;
export type UserRead = z.infer<typeof UserReadSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type TokenPayload = z.infer<typeof TokenPayloadSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;