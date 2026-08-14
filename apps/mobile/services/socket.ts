/**
 * Socket.io Service for React Native with dynamic host resolution
 */

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from './api';

let socket: Socket | null = null;

/**
 * Returns (and instantiates if needed) the singleton Socket instance.
 * Guaranteed to return a valid Socket object so that .on() / .off() never crash.
 */
export const getSocket = (): Socket => {
  if (!socket) {
    const WS_URL = getApiBaseUrl();
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      autoConnect: false,
    });

    socket.on('connect', () => console.log('Socket connected:', socket?.id));
    socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
    socket.on('connect_error', (err) => {
      if (err.message !== 'Authentication token required') {
        console.warn('Socket error:', err.message);
      }
    });
  }
  return socket;
};

/**
 * Connects to the backend WebSocket gateway.
 * Dynamically resolves host IP and attaches JWT auth token from SecureStore.
 */
export const connectSocket = (): Socket => {
  const sock = getSocket();

  SecureStore.getItemAsync('sers_access_token')
    .then((token) => {
      if (token && sock) {
        sock.auth = { token };
        if (!sock.connected) {
          sock.connect();
        }
      }
    })
    .catch(() => {});

  return sock;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
  }
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
