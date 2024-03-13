import io, { type Socket } from 'socket.io-client';
import type { ProviderServerToClientEvents, ProviderClientToServerEvents } from '@common/events';

let socket: Socket<ProviderServerToClientEvents, ProviderClientToServerEvents> | undefined;

function connectTo(url: string) {
  if (socket && socket.connected) {
    console.log('Already connected');
    return;
  }

  socket = io(`${url}/provider`, {
    autoConnect: false,
    reconnection: false,
    transports: ['websocket'],
  });

  socket.connect();

  socket.on('connect', () => {
    console.log(`Connected to: ${url}`);
  });

  socket.on('print', (message: string) => {
    console.log(`Server print: ${message}`);
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected from: ${url}`);
    socket = undefined;
  });
}

function disconnect() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
  socket = undefined;
}

setTimeout(() => {
  connectTo('http://localhost:8080');
}, 5000);
