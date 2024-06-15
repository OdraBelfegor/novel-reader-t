import { io } from 'socket.io-client';
import type { ManagerOptions, SocketOptions, Socket } from 'socket.io-client';

const config: Partial<ManagerOptions & SocketOptions> = {
  transports: ['websocket'],
  autoConnect: false,
  reconnectionAttempts: 1,
};

export class SocketWrapper {
  socket: Socket;
  url: string;
  listeners: Record<string, ((...args: any) => void)[]>;
  constructor(url = '') {
    this.socket = io(url, config);
    this.url = url;
    this.listeners = {};
  }

  connect() {
    this.socket.connect();
  }

  disconnect() {
    this.socket.disconnect();
  }

  changeUrl(url: string) {
    this.disconnect();
    this.url = url;
    this.socket = io(url, config);
    this.registerListerners();
  }

  on(eventName: string, callback: (...args: any) => void) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }

    this.listeners[eventName].push(callback);
    this.socket.on(eventName, callback);
  }

  registerListerners() {
    Object.keys(this.listeners).forEach(eventName => {
      this.socket.off(eventName);
      this.listeners[eventName].forEach(callback => {
        this.socket.on(eventName, callback);
      });
    });
  }

  emit(eventName: string, ...args: any[]) {
    this.socket.emit(eventName, ...args);
  }
}
