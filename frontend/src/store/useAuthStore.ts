import { create } from 'zustand';
import type { UserResponse } from '@/lib/types';

interface AuthState {
  user: UserResponse | null;
  status: 'unknown' | 'authenticated' | 'guest';
  setUser: (u: UserResponse | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  status: 'unknown',
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'guest' }),
}));

export const isAdmin = (u: UserResponse | null): boolean => u?.role === 'ROLE_STORE_ADMIN';
