/**
 * Auth Store (Zustand)
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';

interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'citizen' | 'responder' | 'hospital_staff' | 'admin' | 'coordinator';
  preferredLanguage: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (phone: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

interface RegisterData {
  name: string;
  phone: string;
  password: string;
  role?: string;
  email?: string;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('sers_access_token');
      if (!token) return set({ isLoading: false });
      const res = await api.get('/users/profile');
      set({ user: res.data.data, isAuthenticated: true, isLoading: false });
    } catch {
      await SecureStore.deleteItemAsync('sers_access_token');
      set({ isLoading: false });
    }
  },

  login: async (phone, password) => {
    const res = await api.post('/auth/login', { phone, password });
    const { user, tokens } = res.data.data;
    await SecureStore.setItemAsync('sers_access_token', tokens.accessToken);
    await SecureStore.setItemAsync('sers_refresh_token', tokens.refreshToken);
    set({ user, isAuthenticated: true });
  },

  register: async (data) => {
    const res = await api.post('/auth/register', data);
    const { user, tokens } = res.data.data;
    await SecureStore.setItemAsync('sers_access_token', tokens.accessToken);
    await SecureStore.setItemAsync('sers_refresh_token', tokens.refreshToken);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    await SecureStore.deleteItemAsync('sers_access_token');
    await SecureStore.deleteItemAsync('sers_refresh_token');
    set({ user: null, isAuthenticated: false });
  },
}));
