/**
 * API Client — Axios instance with JWT auto-attach and dynamic host resolution
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Dynamically resolves the API host URL.
 * Automatically adapts between physical phones (over Wi-Fi LAN), Android Emulator (10.0.2.2), and Web/Simulator (localhost).
 */
export const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Auto-detect host IP from Expo Metro bundler URI (works seamlessly on physical phones & emulators)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest?.debuggerHost ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:3000`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
};

const API_BASE = getApiBaseUrl();

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 10000,
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
        const res = await axios.post(`${getApiBaseUrl()}/api/auth/refresh`, { refreshToken });
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
