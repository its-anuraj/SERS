/**
 * Socket.io Service for React Native
 */

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

let socket: Socket | null = null;

export const connectSocket = async (): Promise<Socket> => {
  if (socket?.connected) return socket;

  const token = await SecureStore.getItemAsync('sers_access_token') || '';

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

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
