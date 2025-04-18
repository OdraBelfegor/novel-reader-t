import { type Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@common/socket-events';
import { existsSync } from 'fs';

type HandleOptions = {
  onDisconnect: () => void;
  onEvent: (...args: any[]) => void;
  onCleanup: () => void;
};

export function waitEventOrDisconnect(
  socket: Socket,
  eventName: keyof ClientToServerEvents,
  handlers: HandleOptions,
) {
  socket.on(eventName, (...args: any[]) => {
    cleanup();
    handlers.onEvent(...args);
  });

  socket.on('disconnect', () => {
    cleanup();
    handlers.onDisconnect();
  });

  const cleanup = () => {
    socket.off(eventName, handlers.onEvent);
    socket.off('disconnect', handlers.onDisconnect);
    handlers.onCleanup();
  };
}
export function validateCerts(): { result: boolean; certs: { key: string; cert: string } } {
  const credentials = {
    key: process.env.KEY_PATH || '',
    cert: process.env.CERT_PATH || '',
  };

  if (credentials.key.length === 0 && credentials.cert.length === 0)
    return { result: false, certs: credentials };

  if (!existsSync(credentials.key) || !existsSync(credentials.cert))
    return { result: false, certs: credentials };

  return { result: true, certs: credentials };
}
export async function waitAll(promises: Promise<any>[]): Promise<void> {
  await Promise.all(promises);
}
