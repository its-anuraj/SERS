/**
 * Socket.io Service for React Native with dynamic host resolution
 */

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from './api';

let socket: Socket | null = null;

/**
 * Connects to the backend WebSocket gateway.
 * Dynamically resolves host IP and attaches JWT auth token.
 */
export const connectSocket = (): Socket | null => {
  if (socket?.connected) return socket;

  const WS_URL = getApiBaseUrl();

  // Retrieve token before initial connection to prevent auth handshake errors
  SecureStore.getItemAsync('sers_access_token')
    .then((token) => {
      if (!token) {
        // Not logged in — do not spam connection attempts
        return;
      }

      if (!socket) {
        socket = io(WS_URL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 3000,
        });

        socket.on('connect', () => console.log('Socket connected:', socket?.id));
        socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
        socket.on('connect_error', (err) => {
          if (err.message !== 'Authentication token required') {
            console.warn('Socket error:', err.message);
          }
        });
      } else {
        socket.auth = { token };
        if (!socket.connected) socket.connect();
      }
    })
    .catch(() => {});

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
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
