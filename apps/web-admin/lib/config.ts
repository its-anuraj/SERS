/**
 * Centralized API & WebSocket Endpoint Configuration
 */

export const getApiUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    }
  }

  // Deployed production frontend default
  return 'https://sers-backend-api.onrender.com';
};

export const getWsUrl = (): string => {
  if (process.env.NEXT_PUBLIC_WS_URL && !process.env.NEXT_PUBLIC_WS_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
    }
  }

  // Deployed production WebSocket default
  return 'https://sers-backend-api.onrender.com';
};

export const API_URL = getApiUrl();
export const WS_URL  = getWsUrl();
