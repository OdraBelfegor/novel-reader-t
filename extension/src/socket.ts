import io, { type Socket } from 'socket.io-client';
import type {
  ProviderServerToClientEvents,
  ProviderClientToServerEvents,
} from '@common/socket-events';

type ProviderSocket = Socket<ProviderServerToClientEvents, ProviderClientToServerEvents>;

export class SocketControler {
  socket?: ProviderSocket;
  registerListeners: (socket: ProviderSocket) => void;

  constructor(registerListeners: (socket: ProviderSocket) => void) {
    this.registerListeners = registerListeners;
  }

  connectTo(url: string) {
    if (this.socket && this.socket.connected) {
      console.log('Already connected');
      return;
    }

    this.socket = io(`${url}/provider`, {
      autoConnect: false,
      reconnection: false,
      transports: ['websocket'],
    });

    this.socket.connect();

    this.socket.on('connect', () => {
      console.log(`Connected to: ${url}`);
    });

    this.socket.on('print', (message: string) => {
      console.log(`Server print: ${message}`);
    });

    this.socket.on('disconnect', () => {
      console.log(`Disconnected from: ${url}`);
      this.socket = undefined;
    });

    this.registerListeners(this.socket);
  }

  disconnect() {
    if (this.socket && this.socket.connected) {
      this.socket.disconnect();
    }
    this.socket = undefined;
  }
}
