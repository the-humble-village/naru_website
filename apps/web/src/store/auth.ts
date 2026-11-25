// AI-assisted: see AI-ATTRIBUTION.md
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRead } from '@naru/shared';

export type User = Pick<
  UserRead,
  'id' | 'login' | 'email' | 'firstName' | 'lastName' | 'role' | 'lang'
>;

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  lang: string;
  isAuthenticated: boolean;

  // Actions
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setLanguage: (lang: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      role: null,
      lang: 'en',
      isAuthenticated: false,

      setTokens: (accessToken: string, refreshToken: string) => {
        set({ accessToken, refreshToken, isAuthenticated: !!accessToken });
      },

      setUser: (user: User) => {
        set({
          user,
          role: user.role,
          lang: user.lang,
          isAuthenticated: true
        });
      },

      login: (user: User, accessToken: string, refreshToken: string) => {
        set({
          user,
          accessToken,
          refreshToken,
          role: user.role,
          lang: user.lang,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          role: null,
          isAuthenticated: false,
        });
        // Clear from localStorage
        localStorage.removeItem('auth-storage');
      },

      setLanguage: (lang: string) => {
        set({ lang });
        if (get().user) {
          set({ user: { ...get().user!, lang } });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        role: state.role,
        lang: state.lang,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);