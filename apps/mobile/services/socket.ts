/**
 * Socket.io Service for React Native with dynamic host resolution
 */

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from './api';

let socket: Socket | null = null;

/**
 * Synchronously returns (and creates if needed) the socket.
 * Dynamically connects to host machine whether on physical phone or emulator.
 */
export const connectSocket = (): Socket => {
  if (socket?.connected) return socket;

  const WS_URL = getApiBaseUrl();

  socket = io(WS_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  // Attach auth token async after connection
  SecureStore.getItemAsync('sers_access_token').then((token) => {
    if (token && socket) {
      socket.auth = { token };
      if (!socket.connected) socket.connect();
    }
  }).catch(() => {});

  socket.on('connect', () => console.log('Socket connected:', socket?.id));
  socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
  socket.on('connect_error', (err) => console.warn('Socket error:', err.message));

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};

// Convenience emitters
export const joinIncidentRoom = (incidentId: string) => {
  socket?.emit('incident:join', { incidentId });
};

export const leaveIncidentRoom = (incidentId: string) => {
  socket?.emit('incident:leave', { incidentId });
};

export const emitLocationUpdate = (ambulanceId: string, lat: number, lng: number, heading?: number, speedKmh?: number) => {
  socket?.emit('location:update', { ambulanceId, lat, lng, heading, speedKmh });
};
