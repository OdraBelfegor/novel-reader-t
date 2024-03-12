import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@common/events';

declare global {
  interface Window {
    io: typeof import('socket.io-client').default;
  }
}

let io: typeof import('socket.io-client').default;

if (import.meta.env.DEV) {
  ({ io } = await import('socket.io-client'));
} else {
  io = window.io;
}

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
