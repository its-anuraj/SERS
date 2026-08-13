/**
 * API Client — Axios instance with JWT auto-attach
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' },
});

// Auto-attach JWT
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('sers_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('sers_refresh_token');
        const res = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken });
        const { accessToken } = res.data.data.tokens;
        await SecureStore.setItemAsync('sers_access_token', accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        // Refresh failed — redirect to login
        await SecureStore.deleteItemAsync('sers_access_token');
        await SecureStore.deleteItemAsync('sers_refresh_token');
      }
    }
    return Promise.reject(error);
  }
);
