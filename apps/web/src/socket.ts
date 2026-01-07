import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

let socket: Socket | null = null;

export function initSocket() {
  if (socket) return socket;

  socket = io(API_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to server');
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected from server');
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
