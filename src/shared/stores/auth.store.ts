/**
 * Auth Store
 *
 * Global state management for authentication.
 * Manages user session, permissions, and auth state.
 *
 * IMPORTANT: This store is for client-side state only.
 * Server-side auth should use Supabase server client.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { User, Session } from '@/shared/lib/supabase/types';

// ============================================
// TYPES
// ============================================

/**
 * Application user with role and permissions
 */
export interface AppUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: {
    id: string;
    name: string;
    slug: string;
    level: number;
  } | null;
  permissions: string[];
}

/**
 * Auth store state
 */
interface AuthState {
  // Supabase auth
  user: User | null;
  session: Session | null;

  // Application user (from our database)
  appUser: AppUser | null;

  // State flags
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;

  // Error
  error: string | null;
}

/**
 * Auth store actions
 */
interface AuthActions {
  // Setters
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setAppUser: (appUser: AppUser | null) => void;
  setLoading: (isLoading: boolean) => void;
  setInitialized: (isInitialized: boolean) => void;
  setError: (error: string | null) => void;

  // Auth actions
  login: (user: User, session: Session, appUser: AppUser) => void;
  logout: () => void;
  updateAppUser: (updates: Partial<AppUser>) => void;

  // Permission checks
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasMinimumRoleLevel: (level: number) => boolean;

  // Reset
  reset: () => void;
}

type AuthStore = AuthState & AuthActions;

// ============================================
// INITIAL STATE
// ============================================

const initialState: AuthState = {
  user: null,
  session: null,
  appUser: null,
  isLoading: true,
  isInitialized: false,
  isAuthenticated: false,
  error: null,
};

// ============================================
// STORE
// ============================================

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Setters
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setSession: (session) =>
        set({ session }),

      setAppUser: (appUser) =>
        set({ appUser }),

      setLoading: (isLoading) =>
        set({ isLoading }),

      setInitialized: (isInitialized) =>
        set({ isInitialized }),

      setError: (error) =>
        set({ error }),

      // Auth actions
      login: (user, session, appUser) =>
        set({
          user,
          session,
          appUser,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        }),

      logout: () =>
        set({
          ...initialState,
          isLoading: false,
          isInitialized: true,
        }),

      updateAppUser: (updates) =>
        set((state) => ({
          appUser: state.appUser
            ? { ...state.appUser, ...updates }
            : null,
        })),

      // Permission checks
      hasPermission: (permission) => {
        const { appUser } = get();
        if (!appUser) {
          return false;
        }
        return appUser.permissions.includes(permission);
      },

      hasAnyPermission: (permissions) => {
        const { appUser } = get();
        if (!appUser) {
          return false;
        }
        return permissions.some((p) => appUser.permissions.includes(p));
      },

      hasAllPermissions: (permissions) => {
        const { appUser } = get();
        if (!appUser) {
          return false;
        }
        return permissions.every((p) => appUser.permissions.includes(p));
      },

      hasMinimumRoleLevel: (level) => {
        const { appUser } = get();
        if (!appUser?.role) {
          return false;
        }
        return appUser.role.level >= level;
      },

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        // Only persist essential data
        appUser: state.appUser,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

/**
 * Select user's full name
 */
export const selectFullName = (state: AuthStore): string => {
  if (!state.appUser) {
    return '';
  }
  return `${state.appUser.firstName} ${state.appUser.lastName}`.trim();
};

/**
 * Select user's initials
 */
export const selectInitials = (state: AuthStore): string => {
  if (!state.appUser) {
    return '';
  }
  const first = state.appUser.firstName.charAt(0).toUpperCase();
  const last = state.appUser.lastName.charAt(0).toUpperCase();
  return `${first}${last}`;
};

/**
 * Select user's role name
 */
export const selectRoleName = (state: AuthStore): string => {
  return state.appUser?.role?.name ?? '';
};

/**
 * Select if user is admin (level >= 90)
 */
export const selectIsAdmin = (state: AuthStore): boolean => {
  return (state.appUser?.role?.level ?? 0) >= 90;
};

/**
 * Select if user is super admin (level === 100)
 */
export const selectIsSuperAdmin = (state: AuthStore): boolean => {
  return state.appUser?.role?.level === 100;
};
