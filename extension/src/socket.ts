import io, { type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@common/events';

export class SocketClient {
  socket?: Socket<ServerToClientEvents, ClientToServerEvents>;

  constructor(url: string = 'http://127.0.0.1:5000') {
    this.socket = io(`${url}/provider`, {
      autoConnect: false,
      reconnection: false,
    });
  }
}
