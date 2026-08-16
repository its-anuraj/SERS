/**
 * Auth Store (Zustand) — Ultra-fast, zero-lag authentication state management
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';
import { disconnectSocket } from '../services/socket';

interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'citizen' | 'responder' | 'hospital_staff' | 'admin' | 'coordinator';
  preferredLanguage: string;
  abhaId?: string;
  abhaAddress?: string;
  bloodGroup?: string;
  govtIdType?: string;
  govtIdNumber?: string;
  vehicleNumber?: string;
  badgeId?: string;
  vehicleRegNumber?: string;
  drivingLicense?: string;
  hospitalId?: string;
  hospitalName?: string;
  staffTitle?: string;
  department?: string;
  specialization?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (phone: string, password: string) => Promise<void>;
  sendOTP: (identifier: string) => Promise<{ message: string }>;
  verifyOTP: (identifier: string, otp: string) => Promise<void>;
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
  bloodGroup?: string;
  govtIdType?: string;
  govtIdNumber?: string;
  vehicleNumber?: string;
  badgeId?: string;
  vehicleRegNumber?: string;
  drivingLicense?: string;
  abhaId?: string;
  abhaAddress?: string;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  loadSession: async () => {
    try {
      const [token, cachedUserStr] = await Promise.all([
        SecureStore.getItemAsync('sers_access_token'),
        SecureStore.getItemAsync('sers_user_profile'),
      ]);

      if (!token) {
        return set({ user: null, isAuthenticated: false, isLoading: false });
      }

      // Fast-path: Instant 0ms render with cached user
      if (cachedUserStr) {
        try {
          const cachedUser = JSON.parse(cachedUserStr);
          set({ user: cachedUser, isAuthenticated: true, isLoading: false });
        } catch {}
      }

      // Verify and refresh profile in background without blocking
      api.get('/users/profile')
        .then((res) => {
          if (res.data?.data) {
            set({ user: res.data.data, isAuthenticated: true, isLoading: false });
            SecureStore.setItemAsync('sers_user_profile', JSON.stringify(res.data.data)).catch(() => {});
          }
        })
        .catch(() => {
          if (!cachedUserStr) {
            SecureStore.deleteItemAsync('sers_access_token').catch(() => {});
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (phone, password) => {
    const res = await api.post('/auth/login', { phone, password });
    const { user, tokens } = res.data.data;

    // Instant state update for immediate UI transition
    set({ user, isAuthenticated: true, isLoading: false });

    // Store tokens in parallel
    await Promise.all([
      SecureStore.setItemAsync('sers_access_token', tokens.accessToken),
      SecureStore.setItemAsync('sers_refresh_token', tokens.refreshToken),
      SecureStore.setItemAsync('sers_user_profile', JSON.stringify(user)),
    ]);
  },

  sendOTP: async (identifier) => {
    const res = await api.post('/auth/send-otp', { identifier });
    return res.data?.data || { message: res.data?.message || 'OTP code sent' };
  },

  verifyOTP: async (identifier, otp) => {
    const res = await api.post('/auth/verify-otp', { identifier, otp });
    const { user, tokens } = res.data.data;

    set({ user, isAuthenticated: true, isLoading: false });

    await Promise.all([
      SecureStore.setItemAsync('sers_access_token', tokens.accessToken),
      SecureStore.setItemAsync('sers_refresh_token', tokens.refreshToken),
      SecureStore.setItemAsync('sers_user_profile', JSON.stringify(user)),
    ]);
  },

  register: async (data) => {
    const res = await api.post('/auth/register', data);
    const { user, tokens } = res.data.data;

    // Instant state update
    set({ user, isAuthenticated: true, isLoading: false });

    await Promise.all([
      SecureStore.setItemAsync('sers_access_token', tokens.accessToken),
      SecureStore.setItemAsync('sers_refresh_token', tokens.refreshToken),
      SecureStore.setItemAsync('sers_user_profile', JSON.stringify(user)),
    ]);
  },

  logout: async () => {
    // 1. Immediately disconnect socket and reset auth state (0ms instant response)
    disconnectSocket();
    set({ user: null, isAuthenticated: false, isLoading: false });

    // 2. Clear stored credentials and inform backend asynchronously in background
    Promise.all([
      SecureStore.deleteItemAsync('sers_access_token'),
      SecureStore.deleteItemAsync('sers_refresh_token'),
      SecureStore.deleteItemAsync('sers_user_profile'),
      api.post('/auth/logout').catch(() => {}),
    ]).catch(() => {});
  },
}));
