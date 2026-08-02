import { apiClient } from './client';
import { UserRead, UserCreate, UserUpdate, UserPasswordReset } from '@naru/shared';

/**
 * Fetch all users (admin only)
 */
export const fetchUsers = async (): Promise<UserRead[]> => {
  const response = await apiClient.get<{ users: UserRead[]; total: number }>('/users');
  return response.data.users;
};

/**
 * Fetch current user profile
 */
export const fetchCurrentUser = async (): Promise<UserRead> => {
  const response = await apiClient.get<UserRead>('/users/me');
  return response.data;
};

/**
 * Fetch a single user by ID (admin only)
 */
export const fetchUser = async (id: number): Promise<UserRead> => {
  const response = await apiClient.get<UserRead>(`/users/${id}`);
  return response.data;
};

/**
 * Create a new user (admin only)
 */
export const createUser = async (data: UserCreate): Promise<UserRead> => {
  const response = await apiClient.post<UserRead>('/users', data);
  return response.data;
};

/**
 * Update an existing user (admin only)
 *
 * Accepts every mutable field via `UserUpdate`, including `role` and an optional
 * `password` reset. The response never contains `passwordHash`.
 */
export const updateUser = async (id: number, data: UserUpdate): Promise<UserRead> => {
  const response = await apiClient.put<UserRead>(`/users/${id}`, data);
  return response.data;
};

/**
 * Reset an existing user's password (admin only)
 */
export const resetUserPassword = async (id: number, data: UserPasswordReset): Promise<UserRead> => {
  const response = await apiClient.post<UserRead>(`/users/${id}/password`, data);
  return response.data;
};

/**
 * Delete a user (soft delete, admin only)
 */
export const deleteUser = async (id: number): Promise<void> => {
  await apiClient.delete(`/users/${id}`);
};

/**
 * Update current user's language preference
 */
export const updateLanguage = async (lang: string): Promise<UserRead> => {
  const response = await apiClient.patch<UserRead>('/users/me/language', { lang });
  return response.data;
};

export const usersApi = {
  fetchUsers,
  fetchCurrentUser,
  fetchUser,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
  updateLanguage,
};