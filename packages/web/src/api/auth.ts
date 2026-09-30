import { Login, AuthResponse } from '@naru/shared';
import apiClient from './client';

/**
 * Auth API methods
 */
export const authApi = {
  /**
   * Login with username and password
   */
  login: async (credentials: Login): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  /**
   * Refresh access token using refresh token
   */
  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/refresh', {
      refreshToken,
    });
    return response.data;
  },
};