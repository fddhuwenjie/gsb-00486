import { create } from 'zustand';
import type { User } from '@shared/types';

interface AuthState {
  user: (User & { password?: string }) | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  login: async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    localStorage.setItem('userId', String(data.data.id));
    set({ user: data.data, isAuthenticated: true });
  },

  register: async (username: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    localStorage.setItem('userId', String(data.data.id));
    set({ user: data.data, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('userId');
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      set({ user: null, isAuthenticated: false });
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'x-user-id': userId },
      });
      const data = await res.json();
      if (data.success && data.data) {
        set({ user: data.data, isAuthenticated: true });
      } else {
        localStorage.removeItem('userId');
        set({ user: null, isAuthenticated: false });
      }
    } catch {
      localStorage.removeItem('userId');
      set({ user: null, isAuthenticated: false });
    }
  },
}));
